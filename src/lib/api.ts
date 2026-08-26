import {
  AppSettings,
  ChatMessage,
  GenerationMetrics,
  GroundingSource,
  McpTool,
  McpToolCall,
  OllamaModelItem,
  OpenRouterModelItem,
} from "../types";

export interface StreamCallback {
  onChunk: (chunk: string, fullContent: string, thought: string) => void;
  onMetrics?: (metrics: GenerationMetrics) => void;
  onError?: (err: Error) => void;
  onComplete?: (fullContent: string, thought: string, metrics: GenerationMetrics) => void;
  onGrounding?: (grounding: {
    searchGrounded: boolean;
    searchQuery: string;
    sources: GroundingSource[];
    provider?: string;
  }) => void;
  onMcpToolDetected?: (toolCalls: McpToolCall[]) => void;
}

/**
 * Parses raw streaming text to extract <think>...</think> or <thought>...</thought> blocks
 * returning separated thought and clean response text.
 */
export function extractThoughtsAndContent(rawText: string): { thought: string; content: string } {
  let thought = "";
  let content = rawText;

  // Match both <think>...</think> and <thought>...</thought>
  const thinkRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi;
  let match;
  while ((match = thinkRegex.exec(rawText)) !== null) {
    thought += (thought ? "\n\n" : "") + match[1].trim();
  }

  // Check for unclosed <think> or <thought> tag (currently streaming inside think block)
  const unclosedMatch = rawText.match(/<(?:think|thought)>([\s\S]*)$/i);
  if (unclosedMatch && !rawText.includes(`</${unclosedMatch[0].startsWith("<thought") ? "thought" : "think"}>`)) {
    thought += (thought ? "\n\n" : "") + unclosedMatch[1];
    content = rawText.replace(/<(?:think|thought)>[\s\S]*$/i, "").trim();
    return { thought: thought.trim(), content: content };
  }

  content = rawText.replace(thinkRegex, "").trim();
  return { thought: thought.trim(), content };
}

/**
 * Parses raw text for Model Context Protocol (MCP) tool calls
 * Matches <mcp_call tool="TOOL_NAME">{...}</mcp_call>
 */
export function parseMcpToolCalls(rawText: string): McpToolCall[] {
  const calls: McpToolCall[] = [];
  const regex = /<mcp_call\s+tool=["']([^"']+)["']>([\s\S]*?)<\/mcp_call>/gi;
  let match;
  let idx = 0;

  while ((match = regex.exec(rawText)) !== null) {
    const toolName = match[1].trim();
    const rawArgs = match[2].trim();
    let parsedArgs: Record<string, any> = {};

    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch {
      // If not strict JSON, try key-value or fallback
      parsedArgs = { raw: rawArgs };
    }

    calls.push({
      id: `mcp-call-${Date.now()}-${idx++}`,
      toolName,
      displayName: toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      args: parsedArgs,
      status: "pending",
      timestamp: Date.now(),
    });
  }

  return calls;
}

/**
 * Fetch list of all active MCP Tools from backend
 */
export async function fetchMcpTools(): Promise<McpTool[]> {
  try {
    const res = await fetch("/api/mcp/tools");
    if (!res.ok) return [];
    const data = await res.json();
    return data.tools || [];
  } catch (err) {
    console.error("Failed to fetch MCP tools:", err);
    return [];
  }
}

/**
 * Execute an MCP Tool by Name
 */
export async function executeMcpToolApi(
  toolName: string,
  args: Record<string, any> = {}
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
}> {
  try {
    const res = await fetch("/api/mcp/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName, args }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `HTTP ${res.status}: ${res.statusText}`,
        executionTimeMs: 0,
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to execute MCP tool",
      executionTimeMs: 0,
    };
  }
}

/**
 * Test Custom MCP Server endpoint
 */
export async function testCustomMcpServerApi(url: string): Promise<{
  connected: boolean;
  toolCount?: number;
  tools?: any[];
  error?: string;
  responseTimeMs: number;
}> {
  try {
    const res = await fetch("/api/mcp/custom-server/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || "Failed to contact MCP server test endpoint",
      responseTimeMs: 0,
    };
  }
}

/**
 * Ping Ollama endpoint to verify connection and fetch available local models
 */
export async function checkOllamaConnection(baseUrl: string): Promise<{
  connected: boolean;
  models: OllamaModelItem[];
  error?: string;
  hint?: string;
}> {
  try {
    const res = await fetch("/api/ollama/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl }),
    });
    if (!res.ok) {
      return { connected: false, models: [], error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      connected: false,
      models: [],
      error: err?.message || "Failed to reach Ollama proxy",
    };
  }
}

/**
 * Fetch available models from OpenRouter
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModelItem[]> {
  try {
    const res = await fetch("/api/openrouter/models");
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || [];
  } catch (err) {
    console.error("Failed to fetch OpenRouter models:", err);
    return [];
  }
}

/**
 * Unified Stream Request for JOSIE via Ollama or OpenRouter
 */
export async function streamChatCompletion({
  messages,
  settings,
  systemPrompt,
  callbacks,
  signal,
}: {
  messages: { role: string; content: string }[];
  settings: AppSettings;
  systemPrompt?: string;
  callbacks: StreamCallback;
  signal?: AbortSignal;
}): Promise<void> {
  const startTime = performance.now();
  let accumulatedRaw = "";
  let tokenCount = 0;

  const endpoint =
    settings.provider === "ollama" ? "/api/ollama/chat" : "/api/openrouter/chat";

  const payload: any = {
    provider: settings.provider,
    messages,
    system: systemPrompt,
    webSearch: settings.webSearchEnabled,
    searchSourcesLimit: settings.searchSourcesLimit || 5,
    mcpEnabled: settings.mcpEnabled,
    enabledMcpTools: settings.enabledMcpTools,
    options: {
      temperature: settings.temperature,
      top_p: settings.topP,
      top_k: settings.topK,
      repeat_penalty: settings.repeatPenalty,
      mirostat: settings.mirostat,
      mirostat_tau: settings.mirostatTau,
      mirostat_eta: settings.mirostatEta,
      num_predict: settings.maxTokens,
      num_ctx: settings.contextWindow,
    },
  };

  if (settings.provider === "ollama") {
    payload.baseUrl = settings.ollamaBaseUrl;
    payload.model = settings.ollamaModel;
  } else {
    payload.apiKey = settings.openRouterApiKey;
    payload.model = settings.openRouterModel;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errorMsg = `Server error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) errorMsg = errorJson.error;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    if (!response.body) {
      throw new Error("No response body received from stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let finalEvalCount: number | undefined;
    let finalEvalDurationNs: number | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.substring(6);
          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }

            // Handle server-side search grounding payload
            if (parsed.grounding) {
              callbacks.onGrounding?.(parsed.grounding);
            }

            if (parsed.content) {
              accumulatedRaw += parsed.content;
              tokenCount++;

              const { thought, content } = extractThoughtsAndContent(accumulatedRaw);
              callbacks.onChunk(parsed.content, content, thought);

              if (settings.mcpEnabled && accumulatedRaw.includes("<mcp_call")) {
                const detectedTools = parseMcpToolCalls(accumulatedRaw);
                if (detectedTools.length > 0) {
                  callbacks.onMcpToolDetected?.(detectedTools);
                }
              }

              const now = performance.now();
              const elapsedSeconds = (now - startTime) / 1000;
              if (elapsedSeconds > 0) {
                callbacks.onMetrics?.({
                  tokensPerSecond: tokenCount / elapsedSeconds,
                  totalTokens: tokenCount,
                  durationMs: now - startTime,
                });
              }
            }

            if (parsed.eval_count) {
              finalEvalCount = parsed.eval_count;
            }
            if (parsed.eval_duration) {
              finalEvalDurationNs = parsed.eval_duration;
            }
          } catch (e: any) {
            if (e.message && e.message !== "Unexpected end of JSON input") {
              console.warn("Stream line parse warning:", e);
            }
          }
        }
      }
    }

    const durationMs = performance.now() - startTime;
    const tokensPerSecond =
      finalEvalCount && finalEvalDurationNs
        ? (finalEvalCount / (finalEvalDurationNs / 1e9))
        : durationMs > 0
        ? (tokenCount / (durationMs / 1000))
        : 0;

    const metrics: GenerationMetrics = {
      tokensPerSecond,
      totalTokens: finalEvalCount || tokenCount,
      durationMs,
      evalCount: finalEvalCount,
      evalDurationNs: finalEvalDurationNs,
    };

    const { thought, content } = extractThoughtsAndContent(accumulatedRaw);
    callbacks.onComplete?.(content, thought, metrics);
  } catch (err: any) {
    if (err.name === "AbortError") {
      const durationMs = performance.now() - startTime;
      const { thought, content } = extractThoughtsAndContent(accumulatedRaw);
      callbacks.onComplete?.(content, thought, {
        durationMs,
        totalTokens: tokenCount,
        tokensPerSecond: durationMs > 0 ? tokenCount / (durationMs / 1000) : 0,
      });
      return;
    }
    callbacks.onError?.(err);
  }
}

/**
 * Text to Speech Helper using Web Speech Synthesis
 */
export class TextToSpeechManager {
  private static synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  public static getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public static speak(
    text: string,
    options: {
      voiceName?: string;
      pitch?: number;
      rate?: number;
      onEnd?: () => void;
      onStart?: () => void;
    } = {}
  ) {
    if (!this.synth) return;
    this.stop();

    // Clean text of markdown code blocks or thought tags for clean speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .replace(/[*#_`~>[\]]/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = options.pitch ?? 1.0;
    utterance.rate = options.rate ?? 1.0;

    if (options.voiceName) {
      const voices = this.getVoices();
      const voice = voices.find((v) => v.name === options.voiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      this.currentUtterance = null;
      options.onEnd?.();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public static isSpeaking(): boolean {
    return Boolean(this.synth && this.synth.speaking);
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }
}

/**
 * Speech Recognition (STT) Helper
 */
export function createSpeechRecognizer(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError?: (error: any) => void
) {
  if (typeof window === "undefined") return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const recognizer = new SpeechRecognition();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = "en-US";

  recognizer.onresult = (event: any) => {
    let interim = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interim) {
      onResult(interim, false);
    }
  };

  recognizer.onerror = (event: any) => {
    onError?.(event.error);
  };

  return recognizer;
}

/**
 * Direct Search Grounding query utility
 */
export async function querySearchGrounding(
  query: string,
  limit: number = 5
): Promise<{
  searchGrounded: boolean;
  searchQuery: string;
  sources: GroundingSource[];
  provider?: string;
  formattedContext?: string;
}> {
  try {
    const res = await fetch("/api/search/ground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) {
      throw new Error(`Search failed: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn("Search grounding fetch failed:", err);
    return {
      searchGrounded: false,
      searchQuery: query,
      sources: [],
    };
  }
}

