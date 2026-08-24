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
  onComplete?: (fullContent: string, thought: string, metrics: GenerationMetrics) => void | Promise<void>;
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
  const thoughtParts: string[] = [];
  const closedThoughtRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi;
  let match: RegExpExecArray | null;
  while ((match = closedThoughtRegex.exec(rawText)) !== null) {
    if (match[1].trim()) thoughtParts.push(match[1].trim());
  }

  let content = rawText.replace(closedThoughtRegex, "");
  const openingRegex = /<(?:think|thought)>/gi;
  const closingRegex = /<\/(?:think|thought)>/gi;
  let lastOpening: RegExpExecArray | null;
  let lastOpeningIndex = -1;
  while ((lastOpening = openingRegex.exec(rawText)) !== null) lastOpeningIndex = lastOpening.index;
  let lastClosing: RegExpExecArray | null;
  let lastClosingIndex = -1;
  while ((lastClosing = closingRegex.exec(rawText)) !== null) lastClosingIndex = lastClosing.index;

  if (lastOpeningIndex > lastClosingIndex) {
    const unclosedStart = rawText.slice(lastOpeningIndex).replace(/^<(?:think|thought)>/i, "");
    if (unclosedStart.trim()) thoughtParts.push(unclosedStart);
    content = rawText.slice(0, lastOpeningIndex).replace(closedThoughtRegex, "");
  }

  return { thought: thoughtParts.join("\n\n").trim(), content: content.trim() };
}

/**
 * Parses raw text for Model Context Protocol (MCP) tool calls
 * Matches <mcp_call tool="TOOL_NAME">{...}</mcp_call>
 */
export function parseMcpToolCalls(rawText: string): McpToolCall[] {
  const calls: McpToolCall[] = [];
  const regex = /<mcp_call\s+tool=["']([^"']+)["']>([\s\S]*?)<\/mcp_call>/gi;
  let match;
  let occurrence = 0;
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

    const signature = `${toolName}\u0000${rawArgs}`;
    let hash = 2166136261;
    for (let i = 0; i < signature.length; i += 1) {
      hash ^= signature.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    calls.push({
      id: `mcp-call-${(hash >>> 0).toString(36)}-${occurrence++}`,
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
    let streamDone = false;
    let protocolError: Error | null = null;
    const emittedMcpCalls = new Set<string>();

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ") || streamDone || protocolError) return;
      const dataStr = trimmed.substring(6);
      if (dataStr === "[DONE]") {
        streamDone = true;
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(dataStr);
      } catch (error) {
        console.warn("Stream line parse warning:", error);
        return;
      }

      if (parsed.error) {
        protocolError = new Error(String(parsed.error));
        return;
      }

      if (parsed.grounding) callbacks.onGrounding?.(parsed.grounding);

      if (parsed.content) {
        accumulatedRaw += parsed.content;
        tokenCount++;

        const { thought, content } = extractThoughtsAndContent(accumulatedRaw);
        callbacks.onChunk(parsed.content, content, thought);

        if (settings.mcpEnabled && accumulatedRaw.includes("<mcp_call")) {
          const newCalls = parseMcpToolCalls(accumulatedRaw).filter((call) => {
            if (emittedMcpCalls.has(call.id)) return false;
            emittedMcpCalls.add(call.id);
            return true;
          });
          if (newCalls.length > 0) callbacks.onMcpToolDetected?.(newCalls);
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

      if (parsed.eval_count) finalEvalCount = parsed.eval_count;
      if (parsed.eval_duration) finalEvalDurationNs = parsed.eval_duration;
    };

    while (!streamDone && !protocolError) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) processLine(line);
    }

    if (buffer.trim()) processLine(buffer);
    if (protocolError) throw protocolError;

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
    await callbacks.onComplete?.(content, thought, metrics);
  } catch (err: any) {
    if (err.name === "AbortError") {
      const durationMs = performance.now() - startTime;
      const { thought, content } = extractThoughtsAndContent(accumulatedRaw);
      await callbacks.onComplete?.(content, thought, {
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

