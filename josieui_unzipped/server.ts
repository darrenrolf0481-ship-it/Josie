import express from "express";
import crypto from "node:crypto";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { performSearchGrounding, GroundingResult } from "./server/search";
import {
  BUILTIN_MCP_TOOLS,
  executeMcpTool,
  formatMcpToolsSystemPrompt,
  McpToolDefinition,
} from "./server/mcp";
import { checkRateLimit as defaultCheckRateLimit } from "./server/rateLimit";
import {
  allowLocalMcpTargets,
  allowPrivateNetworkTargets,
  clampNumber,
  fetchSafe,
  validateChatMessages,
  validateOllamaUrl,
} from "./server/security";

dotenv.config();

export async function createApp(options?: {
  checkRateLimit?: typeof defaultCheckRateLimit;
}) {
  const checkRateLimit = options?.checkRateLimit ?? defaultCheckRateLimit;
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));
  const configuredApiToken = process.env.API_TOKEN;
  if (configuredApiToken) {
    app.use("/api", (req, res, next) => {
      const supplied = req.header("authorization")?.replace(/^Bearer\\s+/i, "") || "";
      const expected = Buffer.from(configuredApiToken);
      const actual = Buffer.from(supplied);
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "JOSIE AI Interface Server",
    });
  });

  // Dedicated Search Grounding API
  app.post("/api/search/ground", async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.slice(0, 2_000) : "";
    const limit = clampNumber(req.body?.limit, 5, 1, 10);
    try {
      const result = await performSearchGrounding(query, limit);
      res.json(result);
    } catch (err: any) {
      console.error("Search Grounding API Error:", err);
      res.status(500).json({ error: err?.message || "Search grounding failed" });
    }
  });

  // MCP: List all available tools
  app.get("/api/mcp/tools", (req, res) => {
    res.json({
      tools: BUILTIN_MCP_TOOLS,
      protocol_version: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true },
        prompts: { listChanged: true },
      },
    });
  });

  // MCP: Execute tool call
  app.post("/api/mcp/execute", async (req, res) => {
    const { toolName, args = {} } = req.body ?? {};
    if (typeof toolName !== "string" || toolName.length === 0 || toolName.length > 100 || !args || typeof args !== "object" || Array.isArray(args)) {
      return res.status(400).json({ success: false, error: "Missing toolName parameter" });
    }

    // Rate limiting check
    const identity = req.ip || req.socket.remoteAddress || "anonymous";
    const rateCheck = await checkRateLimit(toolName, identity);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        executionTimeMs: 0,
        remaining: rateCheck.remaining,
      });
    }

    try {
      const result = await executeMcpTool(toolName, args);
      res.json(result);
    } catch (err: any) {
      console.error(`MCP tool execution error [${toolName}]:`, err);
      res.status(500).json({
        success: false,
        error: err?.message || `Failed to execute MCP tool ${toolName}`,
        executionTimeMs: 0,
      });
    }
  });

  // MCP: Test external MCP server connection
  app.post("/api/mcp/custom-server/test", async (req, res) => {
    const { url } = req.body ?? {};
    if (typeof url !== "string" || url.length > 2048) {
      return res.status(400).json({ success: false, error: "Valid HTTP/HTTPS URL is required" });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 4000);

      let probeRes: Response;
      try {
        probeRes = await fetchSafe(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "mcp-probe-1",
            method: "tools/list",
            params: {},
          }),
          signal: controller.signal,
        }, {
          allowLoopback: allowLocalMcpTargets(),
          allowPrivateNetwork: allowPrivateNetworkTargets(),
        });
      } finally {
        clearTimeout(tid);
      }

      if (!probeRes.ok) {
        return res.json({
          connected: false,
          error: `HTTP ${probeRes.status}: ${probeRes.statusText}`,
          responseTimeMs: Date.now() - startTime,
        });
      }

      const data = await probeRes.json();
      const tools = data?.result?.tools || [];

      res.json({
        connected: true,
        toolCount: tools.length,
        tools,
        responseTimeMs: Date.now() - startTime,
      });
    } catch (err: any) {
      res.json({
        connected: false,
        error: err?.message || "Could not connect to MCP server endpoint",
        responseTimeMs: Date.now() - startTime,
      });
    }
  });

  // Ollama status & model list ping
  app.post("/api/ollama/status", async (req, res) => {
    const baseUrl = typeof req.body?.baseUrl === "string"
      ? req.body.baseUrl
      : process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    try {
      await validateOllamaUrl(baseUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let tagsRes: Response;
      try {
        tagsRes = await fetchSafe(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
          signal: controller.signal,
        }, { allowLoopback: true, allowPrivateNetwork: allowPrivateNetworkTargets() });

      } finally {
        clearTimeout(timeoutId);
      }

      if (!tagsRes.ok) {
        return res.status(tagsRes.status).json({
          connected: false,
          error: `Ollama returned HTTP ${tagsRes.status}: ${tagsRes.statusText}`,
          baseUrl,
        });
      }

      const data = await tagsRes.json();
      return res.json({
        connected: true,
        baseUrl,
        models: (data as any)?.models || [],
      });
    } catch (err: any) {
      return res.status(200).json({
        connected: false,
        error: err?.message || "Failed to connect to Ollama",
        baseUrl,
        hint: "Make sure Ollama is running locally (`ollama run goekdenizguelmez/JOSIE` or `ollama serve`). If running in browser or behind proxy, set OLLAMA_ORIGINS=\"*\".",
      });
    }
  });

  // Streaming Ollama Chat
  app.post("/api/ollama/chat", async (req, res) => {
    const {
      baseUrl = "http://127.0.0.1:11434",
      model = "goekdenizguelmez/JOSIE",
      messages = [],
      options,
      system,
      webSearch = false,
      searchSourcesLimit = 5,
      mcpEnabled = false,
      enabledMcpTools = [],
    } = req.body;

    if (!validateChatMessages(messages) || typeof model !== "string" || model.length > 200) {
      return res.status(400).json({ error: "Invalid chat request" });
    }
    const targetUrl = `${baseUrl.replace(/\/$/, "")}/api/chat`;

    try {
      await validateOllamaUrl(baseUrl);
      let groundingInfo: GroundingResult | null = null;
      let effectiveSystem = system || "";

      // Inject MCP Tools schema into system prompt if MCP is active
      if (mcpEnabled) {
        const activeTools = enabledMcpTools && enabledMcpTools.length > 0
          ? BUILTIN_MCP_TOOLS.filter((t) => enabledMcpTools.includes(t.name))
          : BUILTIN_MCP_TOOLS;
        const mcpPrompt = formatMcpToolsSystemPrompt(activeTools);
        if (mcpPrompt) {
          effectiveSystem = effectiveSystem ? `${effectiveSystem}\n\n${mcpPrompt}` : mcpPrompt;
        }
      }

      // Perform Search Grounding if requested
      if (webSearch && Array.isArray(messages)) {
        const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content;
        if (lastUser) {
          try {
            groundingInfo = await performSearchGrounding(lastUser, searchSourcesLimit);
            if (groundingInfo && groundingInfo.formattedContext) {
              effectiveSystem = effectiveSystem
                ? `${effectiveSystem}\n\n${groundingInfo.formattedContext}`
                : groundingInfo.formattedContext;
            }
          } catch (e) {
            console.warn("Search grounding error during Ollama request:", e);
          }
        }
      }

      const payload: any = {
        model,
        messages: messages.filter((m: any) => m.role !== "system"),
        stream: true,
        options: options || {},
      };

      if (effectiveSystem) {
        payload.messages = [
          { role: "system", content: effectiveSystem },
          ...payload.messages,
        ];
      }

      const ollamaRes = await fetchSafe(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, { allowLoopback: true, allowPrivateNetwork: allowPrivateNetworkTargets() });


      if (!ollamaRes.ok) {
        const errorText = await ollamaRes.text();
        return res.status(ollamaRes.status).json({
          error: `Ollama error (${ollamaRes.status}): ${errorText}`,
        });
      }

      // Set headers for Server-Sent Events / Chunked streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // If search grounding retrieved sources, emit grounding event first
      if (groundingInfo && groundingInfo.sources.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            grounding: {
              searchGrounded: true,
              searchQuery: groundingInfo.searchQuery,
              sources: groundingInfo.sources,
              provider: groundingInfo.provider,
            },
          })}\n\n`
        );
      }

      if (!ollamaRes.body) {
        res.write(`data: ${JSON.stringify({ error: "Empty stream from Ollama" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let upstreamDone = false;

      while (!upstreamDone) {
        const { done, value } = await reader.read();
        if (done) {
          upstreamDone = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const chunkContent = parsed.message?.content || "";
            const isDone = parsed.done === true;
            const evalCount = parsed.eval_count;
            const evalDuration = parsed.eval_duration;

            res.write(
              `data: ${JSON.stringify({
                content: chunkContent,
                done: isDone,
                eval_count: evalCount,
                eval_duration: evalDuration,
                total_duration: parsed.total_duration,
              })}\n\n`
            );
          } catch {
            // Ignore malformed upstream lines.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          res.write(`data: ${JSON.stringify({
            content: parsed.message?.content || "",
            done: parsed.done === true,
            eval_count: parsed.eval_count,
            eval_duration: parsed.eval_duration,
            total_duration: parsed.total_duration,
          })}\n\n`);
        } catch {
          // Ignore an incomplete upstream fragment.
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Error proxying to Ollama:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to reach Ollama" });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  });

  // Streaming OpenRouter Chat
  app.post("/api/openrouter/chat", async (req, res) => {
    const {
      apiKey,
      model = "openrouter/auto",
      messages = [],
      options,
      system,
      webSearch = false,
      searchSourcesLimit = 5,
      mcpEnabled = false,
      enabledMcpTools = [],
    } = req.body;
    if (!validateChatMessages(messages) || typeof model !== "string" || model.length > 200) {
      return res.status(400).json({ error: "Invalid chat request" });
    }
    const token = typeof apiKey === "string" ? apiKey : process.env.OPENROUTER_API_KEY;

    if (!token) {
      return res.status(400).json({
        error: "OpenRouter API Key is missing. Please provide it in Settings or set OPENROUTER_API_KEY in environment.",
      });
    }

    try {
      let groundingInfo: GroundingResult | null = null;
      let effectiveSystem = system || "";

      // Inject MCP Tools schema into system prompt if MCP is active
      if (mcpEnabled) {
        const activeTools = enabledMcpTools && enabledMcpTools.length > 0
          ? BUILTIN_MCP_TOOLS.filter((t) => enabledMcpTools.includes(t.name))
          : BUILTIN_MCP_TOOLS;
        const mcpPrompt = formatMcpToolsSystemPrompt(activeTools);
        if (mcpPrompt) {
          effectiveSystem = effectiveSystem ? `${effectiveSystem}\n\n${mcpPrompt}` : mcpPrompt;
        }
      }

      // Perform Search Grounding if requested
      if (webSearch && Array.isArray(messages)) {
        const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content;
        if (lastUser) {
          try {
            groundingInfo = await performSearchGrounding(lastUser, searchSourcesLimit);
            if (groundingInfo && groundingInfo.formattedContext) {
              effectiveSystem = effectiveSystem
                ? `${effectiveSystem}\n\n${groundingInfo.formattedContext}`
                : groundingInfo.formattedContext;
            }
          } catch (e) {
            console.warn("Search grounding error during OpenRouter request:", e);
          }
        }
      }

      const formattedMessages = effectiveSystem
        ? [{ role: "system", content: effectiveSystem }, ...messages.filter((m: any) => m.role !== "system")]
        : messages;

      const payload: any = {
        model,
        messages: formattedMessages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.top_p ?? 0.9,
        max_tokens: options?.num_predict || options?.max_tokens || 4096,
      };

      const openRouterRes = await fetchSafe("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "HTTP-Referer": "https://ai.studio/build",
          "X-Title": "JOSIE AI Interface",
        },
        body: JSON.stringify(payload),
      }, { allowPrivateNetwork: false });

      if (!openRouterRes.ok) {
        const errorText = await openRouterRes.text();
        return res.status(openRouterRes.status).json({
          error: `OpenRouter error (${openRouterRes.status}): ${errorText}`,
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // If search grounding retrieved sources, emit grounding event first
      if (groundingInfo && groundingInfo.sources.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            grounding: {
              searchGrounded: true,
              searchQuery: groundingInfo.searchQuery,
              sources: groundingInfo.sources,
              provider: groundingInfo.provider,
            },
          })}\n\n`
        );
      }

      if (!openRouterRes.body) {
        res.write(`data: ${JSON.stringify({ error: "Empty stream from OpenRouter" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      const reader = openRouterRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let upstreamDone = false;

      while (!upstreamDone) {
        const { done, value } = await reader.read();
        if (done) {
          upstreamDone = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.substring(6);
            if (dataStr === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              res.write(
                `data: ${JSON.stringify({
                  content: delta,
                  done: false,
                  usage: parsed.usage,
                })}\n\n`
              );
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      if (buffer.trim().startsWith("data: ")) {
        const dataStr = buffer.trim().substring(6);
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            res.write(`data: ${JSON.stringify({
              content: parsed.choices?.[0]?.delta?.content || "",
              done: false,
              usage: parsed.usage,
            })}\n\n`);
          } catch {
            // Ignore an incomplete upstream fragment.
          }
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("OpenRouter proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to reach OpenRouter" });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  });

  // OpenRouter models catalog fetch
  app.get("/api/openrouter/models", async (req, res) => {
    try {
      const response = await fetchSafe("https://openrouter.ai/api/v1/models");
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch OpenRouter models" });
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development (skip in tests)
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
  if (process.env.NODE_ENV !== "production" && !isTest) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = 3000;
  const host = process.env.HOST || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && !process.env.API_TOKEN) {
    throw new Error("API_TOKEN is required when HOST is not loopback");
  }
  app.listen(PORT, host, () => {
    console.log(`JOSIE UI Server running on http://${host}:${PORT}`);
  });
}

// Only auto-start when this file is run directly (not imported by tests)
const isMainModule = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js") || process.argv[1].endsWith("tsx"));
if (isMainModule) {
  startServer();
}
