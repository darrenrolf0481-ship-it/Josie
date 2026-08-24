import fs from "fs";
import path from "path";
import { runIsolatedCode } from "./codeRunner";
import { evaluateMathExpression } from "./math";
import { allowPrivateNetworkTargets, fetchSafe, isPathInside } from "./security";

export interface McpToolDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category:
    | "Execution"
    | "Web & Network"
    | "Workspace & Files"
    | "System Vitals"
    | "Memory & Store"
    | "DeepSeek Harness"
    | "Custom MCP";
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: any;
        enum?: string[];
      }
    >;
    required?: string[];
  };
  enabled: boolean;
  server: string;
}

// In-memory MCP Key-Value Storage
const mcpMemoryStore: Map<string, { value: any; updatedAt: number }> = new Map([
  ["welcome_note", { value: "JOSIE MCP Protocol initialized successfully.", updatedAt: Date.now() }],
]);

export const BUILTIN_MCP_TOOLS: McpToolDefinition[] = [
  {
    id: "mcp-execute-code",
    name: "execute_code",
    displayName: "Code Execution Sandbox",
    description:
      "Execute JavaScript/TypeScript logic in an isolated VM sandbox. Captures console.log, return values, and execution runtime.",
    category: "Execution",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "JavaScript code block to execute (e.g., 'const arr = [1,2,3]; return arr.reduce((a,b)=>a+b,0);')",
        },
        timeoutMs: {
          type: "number",
          description: "Execution timeout limit in milliseconds (default: 3000ms)",
          default: 3000,
        },
      },
      required: ["code"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-calculate-math",
    name: "calculate_math",
    displayName: "Math & Computation Engine",
    description:
      "High-precision mathematical expression evaluator. Supports advanced arithmetic, trigonometry, statistics, and algebraic formulas.",
    category: "Execution",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to evaluate (e.g. 'Math.sqrt(144) * Math.sin(Math.PI / 4) + Math.pow(2, 8)')",
        },
      },
      required: ["expression"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-fetch-url",
    name: "fetch_url",
    displayName: "Web & API Fetcher",
    description: "Fetch web pages or REST APIs. Converts HTML to clean readable text or returns structured JSON payload.",
    category: "Web & Network",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Valid HTTP or HTTPS URL to retrieve",
        },
        format: {
          type: "string",
          description: "Desired output format: 'text', 'json', or 'markdown'",
          enum: ["text", "json", "markdown"],
          default: "text",
        },
        maxBytes: {
          type: "number",
          description: "Maximum response payload bytes to retrieve (default: 50000)",
          default: 50000,
        },
      },
      required: ["url"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-list-workspace-files",
    name: "list_workspace_files",
    displayName: "Workspace File Tree",
    description: "Explore files and directories within the workspace or deepseek-harness repository.",
    category: "Workspace & Files",
    parameters: {
      type: "object",
      properties: {
        subDirectory: {
          type: "string",
          description: "Relative directory path (e.g. 'src', 'src/components', 'deepseek-harness')",
          default: ".",
        },
        recursive: {
          type: "boolean",
          description: "Whether to list subdirectories recursively (max depth 3)",
          default: false,
        },
      },
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-read-workspace-file",
    name: "read_workspace_file",
    displayName: "Workspace File Reader",
    description: "Read the full or sliced contents of a specific file in the workspace.",
    category: "Workspace & Files",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to file in workspace (e.g. 'package.json', 'src/types.ts')",
        },
        maxLines: {
          type: "number",
          description: "Maximum lines to read from the start of the file (default: 200)",
          default: 200,
        },
      },
      required: ["filePath"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-get-system-vitals",
    name: "get_system_vitals",
    displayName: "System & LLM Vitals Probe",
    description:
      "Inspect runtime memory consumption, CPU architecture, platform uptime, Ollama service connectivity, and active models.",
    category: "System Vitals",
    parameters: {
      type: "object",
      properties: {
        includeOllamaCheck: {
          type: "boolean",
          description: "Whether to probe the local Ollama daemon on http://127.0.0.1:11434",
          default: true,
        },
      },
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-keyval-get",
    name: "mcp_keyval_get",
    displayName: "Memory Store: Get Key",
    description: "Retrieve a saved variable or memory record from JOSIE's MCP memory store.",
    category: "Memory & Store",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Key name to retrieve",
        },
      },
      required: ["key"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-keyval-set",
    name: "mcp_keyval_set",
    displayName: "Memory Store: Set Key",
    description: "Persist a variable, note, or memory state into JOSIE's MCP memory store.",
    category: "Memory & Store",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Key identifier",
        },
        value: {
          type: "string",
          description: "Value or JSON payload to store",
        },
      },
      required: ["key", "value"],
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-keyval-list",
    name: "mcp_keyval_list",
    displayName: "Memory Store: List All Keys",
    description: "List all keys and metadata currently persisted in the MCP key-value memory store.",
    category: "Memory & Store",
    parameters: {
      type: "object",
      properties: {},
    },
    enabled: true,
    server: "builtin",
  },
  {
    id: "mcp-deepseek-harness-status",
    name: "deepseek_harness_status",
    displayName: "DeepSeek Harness & Cordis Matrix",
    description: "Inspect the cloned deepseek-ai/deepseek-harness repository status, Cordis plugins, and benchmark suite.",
    category: "DeepSeek Harness",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional filter for packages or benchmarks (e.g. 'mcp', 'acp', 'sandbox', 'humaneval')",
        },
      },
    },
    enabled: true,
    server: "builtin",
  },
];

/**
 * Execute an MCP Tool by Name
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
}> {
  const startTime = Date.now();

  try {
    switch (toolName) {
      // 1. Code Execution Sandbox
      case "execute_code": {
        const rawCode = args.code || "";
        const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 3000, 500), 10000);

        if (!rawCode.trim()) {
          throw new Error("No code provided for execution");
        }

        const { value: result, logs } = await runIsolatedCode(rawCode, timeoutMs);

        return {
          success: true,
          result: {
            return_value: result !== undefined ? result : null,
            logs,
            execution_status: "COMPLETED",
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 2. Math & Computation Engine
      case "calculate_math": {
        const expression = args.expression || "";
        if (!expression.trim()) {
          throw new Error("No mathematical expression provided");
        }

        const evalResult = evaluateMathExpression(expression);

        return {
          success: true,
          result: {
            expression,
            calculated_value: evalResult,
            type: typeof evalResult,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 3. Web & API Fetcher
      case "fetch_url": {
        const targetUrl = args.url;
        if (typeof targetUrl !== "string") {
          throw new Error("Invalid URL. Must be an HTTP or HTTPS URL");
        }

        const format = ["text", "json", "markdown"].includes(args.format) ? args.format : "text";
        const maxBytes = Math.min(Math.max(Number(args.maxBytes) || 50000, 1_000), 200_000);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        let fetchRes: Response;
        try {
          fetchRes = await fetchSafe(targetUrl, {
            headers: {
              "User-Agent": "JOSIE-MCP-Protocol/1.0 (+https://ai.studio)",
              Accept: "application/json, text/html, text/plain, */*",
            },
            signal: controller.signal,
          }, { allowPrivateNetwork: allowPrivateNetworkTargets() });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!fetchRes.ok) {
          throw new Error(`HTTP Error ${fetchRes.status}: ${fetchRes.statusText}`);
        }

        const contentType = fetchRes.headers.get("content-type") || "";
        let content: any;

        const responseText = await fetchRes.text();
        if (Buffer.byteLength(responseText, "utf8") > maxBytes) {
          throw new Error(`Response exceeds the ${maxBytes}-byte limit`);
        }

        if (format === "json" || contentType.includes("application/json")) {
          try {
            content = JSON.parse(responseText);
          } catch {
            content = responseText.slice(0, maxBytes);
          }
        } else {
          const rawText = responseText;
          let cleaned = rawText;
          if (contentType.includes("text/html")) {
            // Strip script & style tags
            cleaned = cleaned
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          }
          content = cleaned.slice(0, maxBytes);
        }

        return {
          success: true,
          result: {
            url: targetUrl,
            status: fetchRes.status,
            content_type: contentType,
            content,
            byte_length: typeof content === "string" ? content.length : JSON.stringify(content).length,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 4. Workspace File Tree
      case "list_workspace_files": {
        const subDir = args.subDirectory || ".";
        const recursive = Boolean(args.recursive);
        const resolvedPath = path.resolve(process.cwd(), subDir);

        // Security check: ensure path is inside workspace
        const workspaceRoot = fs.realpathSync(process.cwd());
        if (!isPathInside(workspaceRoot, resolvedPath)) {
          throw new Error("Path traversal outside workspace root is strictly forbidden");
        }

        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Directory does not exist: ${subDir}`);
        }
        const realResolvedPath = fs.realpathSync(resolvedPath);
        if (!isPathInside(workspaceRoot, realResolvedPath)) {
          throw new Error("Symlink traversal outside workspace root is strictly forbidden");
        }

        const files = listDirectoryFiles(realResolvedPath, workspaceRoot, recursive ? 3 : 1);

        return {
          success: true,
          result: {
            directory: subDir,
            total_items: files.length,
            items: files.slice(0, 100),
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 5. Read Workspace File
      case "read_workspace_file": {
        const filePath = args.filePath;
        if (!filePath) {
          throw new Error("No filePath provided");
        }

        const maxLines = Math.min(Math.max(Number(args.maxLines) || 200, 1), 1000);
        const resolvedPath = path.resolve(process.cwd(), filePath);

        const workspaceRoot = fs.realpathSync(process.cwd());
        if (!isPathInside(workspaceRoot, resolvedPath)) {
          throw new Error("Path traversal outside workspace root is forbidden");
        }

        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        const realResolvedPath = fs.realpathSync(resolvedPath);
        if (!isPathInside(workspaceRoot, realResolvedPath)) {
          throw new Error("Symlink traversal outside workspace root is forbidden");
        }

        const stats = fs.statSync(realResolvedPath);
        if (stats.isDirectory()) {
          throw new Error(`${filePath} is a directory, not a file. Use list_workspace_files instead.`);
        }

        if (stats.size > 500000) {
          throw new Error(`File size (${(stats.size / 1024).toFixed(1)} KB) exceeds reading limit.`);
        }

        const fileContent = fs.readFileSync(realResolvedPath, "utf-8");
        const lines = fileContent.split("\n");
        const sliced = lines.slice(0, maxLines).join("\n");

        return {
          success: true,
          result: {
            filePath,
            totalLines: lines.length,
            shownLines: Math.min(lines.length, maxLines),
            sizeBytes: stats.size,
            content: sliced,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 6. System & LLM Vitals Probe
      case "get_system_vitals": {
        const mem = process.memoryUsage();
        const includeOllama = args.includeOllamaCheck !== false;
        let ollamaOnline = false;
        let ollamaModels: string[] = [];

        if (includeOllama) {
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 1200);
            let ollamaRes: Response;
            try {
              ollamaRes = await fetch("http://127.0.0.1:11434/api/tags", {
                signal: controller.signal,
              });
            } finally {
              clearTimeout(tid);
            }
            if (ollamaRes.ok) {
              const data = await ollamaRes.json();
              ollamaOnline = true;
              ollamaModels = (data.models || []).map((m: any) => m.name || m.model);
            }
          } catch {
            ollamaOnline = false;
          }
        }

        const hasHarness = fs.existsSync(path.resolve(process.cwd(), "deepseek-harness"));

        return {
          success: true,
          result: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime_seconds: Math.round(process.uptime()),
            memory_rss_mb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
            memory_heap_used_mb: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
            memory_heap_total_mb: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
            ollama_status: ollamaOnline ? "ONLINE" : "UNREACHABLE",
            ollama_installed_models: ollamaModels,
            deepseek_harness_present: hasHarness,
            timestamp: new Date().toISOString(),
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 7. Memory Store: Get Key
      case "mcp_keyval_get": {
        const key = String(args.key || "");
        if (!key) throw new Error("Key is required");

        const entry = mcpMemoryStore.get(key);
        return {
          success: true,
          result: entry
            ? { found: true, key, value: entry.value, updatedAt: new Date(entry.updatedAt).toISOString() }
            : { found: false, key, value: null },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 8. Memory Store: Set Key
      case "mcp_keyval_set": {
        const key = String(args.key || "");
        const value = args.value;
        if (!key) throw new Error("Key is required");

        let parsedVal = value;
        if (typeof value === "string") {
          try {
            parsedVal = JSON.parse(value);
          } catch {
            parsedVal = value;
          }
        }

        mcpMemoryStore.set(key, { value: parsedVal, updatedAt: Date.now() });

        return {
          success: true,
          result: {
            stored: true,
            key,
            totalKeysStored: mcpMemoryStore.size,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 9. Memory Store: List All Keys
      case "mcp_keyval_list": {
        const list = Array.from(mcpMemoryStore.entries()).map(([k, v]) => ({
          key: k,
          valuePreview: typeof v.value === "object" ? JSON.stringify(v.value).slice(0, 100) : String(v.value).slice(0, 100),
          updatedAt: new Date(v.updatedAt).toISOString(),
        }));

        return {
          success: true,
          result: {
            total_keys: list.length,
            keys: list,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 10. DeepSeek Harness & Cordis Matrix
      case "deepseek_harness_status": {
        const harnessDir = path.resolve(process.cwd(), "deepseek-harness");
        const query = (args.query || "").toLowerCase();

        if (!fs.existsSync(harnessDir)) {
          return {
            success: true,
            result: {
              status: "NOT_CLONED",
              message: "deepseek-harness repository is not yet cloned in workspace.",
            },
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Read packages or subdirectories in deepseek-harness
        const entries = fs.readdirSync(harnessDir, { withFileTypes: true });
        const items = entries
          .filter((e) => !e.name.startsWith("."))
          .map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
          }))
          .filter((e) => !query || e.name.toLowerCase().includes(query));

        return {
          success: true,
          result: {
            status: "ACTIVE",
            path: "deepseek-harness",
            items_found: items.length,
            modules: items,
            benchmarks_supported: ["HumanEval", "MATH-500", "MMLU-Pro", "GSM8K", "LiveBench", "Cordis-Agent"],
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unrecognized MCP tool: '${toolName}'`);
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Helper to recursively list files in directory
 */
function listDirectoryFiles(
  dir: string,
  root: string,
  maxDepth: number,
  currentDepth: number = 1
): Array<{ path: string; name: string; type: "file" | "dir"; sizeBytes?: number }> {
  if (currentDepth > maxDepth) return [];

  const results: Array<{ path: string; name: string; type: "file" | "dir"; sizeBytes?: number }> = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        results.push({
          path: relativePath,
          name: entry.name,
          type: "dir",
        });
        if (currentDepth < maxDepth) {
          results.push(...listDirectoryFiles(fullPath, root, maxDepth, currentDepth + 1));
        }
      } else {
        let sizeBytes: number | undefined;
        try {
          sizeBytes = fs.statSync(fullPath).size;
        } catch {}
        results.push({
          path: relativePath,
          name: entry.name,
          type: "file",
          sizeBytes,
        });
      }
    }
  } catch {}

  return results;
}

function formatLog(msg: any): string {
  if (typeof msg === "object" && msg !== null) {
    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }
  return String(msg);
}

/**
 * Format MCP tools system prompt to empower models to invoke tools
 */
export function formatMcpToolsSystemPrompt(tools: McpToolDefinition[]): string {
  const activeTools = tools.filter((t) => t.enabled);
  if (activeTools.length === 0) return "";

  const toolDescriptions = activeTools
    .map((t) => {
      return `### Tool: \`${t.name}\`
Description: ${t.description}
Parameters schema:
\`\`\`json
${JSON.stringify(t.parameters, null, 2)}
\`\`\``;
    })
    .join("\n\n");

  return `[MODEL CONTEXT PROTOCOL (MCP) - ACTIVE TOOLS]
You have direct access to the following Model Context Protocol (MCP) functions.
When you need to execute code, compute calculations, fetch web data, inspect files, check system vitals, or store/retrieve memory records, invoke them using the exact XML block syntax:

<mcp_call tool="TOOL_NAME">
{
  "arg_name": "arg_value"
}
</mcp_call>

Available MCP Tools:
${toolDescriptions}

Instructions for JOSIE:
1. If the user asks you to calculate complex math, run code, read files, or check telemetry, invoke the appropriate <mcp_call> tool block.
2. The environment will immediately execute the tool and return the output to you.
3. Incorporate the tool results into your answer.`;
}
