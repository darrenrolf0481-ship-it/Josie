import { AppSettings, ChatMessage, Conversation, JosiePersona } from "../types";
import { DEFAULT_SETTINGS, JOSIE_PERSONAS } from "./constants";

const STORAGE_KEYS = {
  SETTINGS: "josie_settings_v1",
  CONVERSATIONS: "josie_conversations_v1",
  ACTIVE_CONVERSATION_ID: "josie_active_conv_id",
  CUSTOM_PERSONAS: "josie_custom_personas_v1",
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function sanitizeSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? value : {};
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    enabledMcpTools: Array.isArray(input.enabledMcpTools)
      ? input.enabledMcpTools.filter((item: unknown): item is string => typeof item === "string").slice(0, 100)
      : [...DEFAULT_SETTINGS.enabledMcpTools],
    customMcpServers: Array.isArray(input.customMcpServers) ? input.customMcpServers.slice(0, 20) : [],
  };

  if (merged.provider !== "ollama" && merged.provider !== "openrouter") merged.provider = DEFAULT_SETTINGS.provider;
  if (!["dark", "light", "cyber"].includes(merged.theme)) merged.theme = DEFAULT_SETTINGS.theme;
  if (typeof merged.ollamaBaseUrl !== "string" || merged.ollamaBaseUrl.length > 2048) merged.ollamaBaseUrl = DEFAULT_SETTINGS.ollamaBaseUrl;
  if (typeof merged.ollamaModel !== "string" || merged.ollamaModel.length > 200) merged.ollamaModel = DEFAULT_SETTINGS.ollamaModel;
  if (typeof merged.openRouterApiKey !== "string" || merged.openRouterApiKey.length > 500) merged.openRouterApiKey = "";
  if (typeof merged.openRouterModel !== "string" || merged.openRouterModel.length > 200) merged.openRouterModel = DEFAULT_SETTINGS.openRouterModel;

  const numericDefaults: Array<[keyof AppSettings, number, number, number]> = [
    ["temperature", DEFAULT_SETTINGS.temperature, 0, 2],
    ["topP", DEFAULT_SETTINGS.topP, 0, 1],
    ["topK", DEFAULT_SETTINGS.topK, 1, 100],
    ["repeatPenalty", DEFAULT_SETTINGS.repeatPenalty, 1, 2],
    ["mirostat", DEFAULT_SETTINGS.mirostat, 0, 2],
    ["mirostatTau", DEFAULT_SETTINGS.mirostatTau, 0, 20],
    ["mirostatEta", DEFAULT_SETTINGS.mirostatEta, 0, 2],
    ["maxTokens", DEFAULT_SETTINGS.maxTokens, 1, 32_000],
    ["contextWindow", DEFAULT_SETTINGS.contextWindow, 512, 128_000],
    ["searchSourcesLimit", DEFAULT_SETTINGS.searchSourcesLimit, 1, 10],
    ["speechPitch", DEFAULT_SETTINGS.speechPitch, 0, 2],
    ["speechRate", DEFAULT_SETTINGS.speechRate, 0.1, 3],
  ];
  for (const [key, fallback, min, max] of numericDefaults) {
    const numeric = Number(merged[key]);
    (merged as any)[key] = Number.isFinite(numeric) ? Math.min(Math.max(numeric, min), max) : fallback;
  }

  return merged;
}

function sanitizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  if (!["user", "assistant", "system"].includes(value.role) || typeof value.content !== "string") return null;
  if (value.content.length > 500_000) return null;
  return {
    ...value,
    id: typeof value.id === "string" && value.id.length <= 200 ? value.id : crypto.randomUUID(),
    role: value.role,
    content: value.content,
    timestamp: Number.isFinite(Number(value.timestamp)) ? Number(value.timestamp) : Date.now(),
  } as ChatMessage;
}

export function sanitizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (!Array.isArray(value.messages) || value.messages.length > 500) return null;
  const messages = value.messages.map(sanitizeMessage).filter((message): message is ChatMessage => Boolean(message));
  if (messages.length !== value.messages.length) return null;
  if (value.provider !== "ollama" && value.provider !== "openrouter") return null;
  return {
    ...value,
    id: value.id.slice(0, 200),
    title: value.title.slice(0, 200),
    messages,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : Date.now(),
    provider: value.provider,
    model: typeof value.model === "string" ? value.model.slice(0, 200) : DEFAULT_SETTINGS.ollamaModel,
  } as Conversation;
}

export function sanitizePersonas(value: unknown): JosiePersona[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).filter((persona) =>
    typeof persona.id === "string" && typeof persona.name === "string" && typeof persona.systemPrompt === "string"
  ).slice(0, 50) as JosiePersona[];
}

export function getStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(sanitizeSettings(settings)));
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

export function sanitizeConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeConversation)
    .filter((conversation): conversation is Conversation => Boolean(conversation))
    .slice(0, 100);
}

export function getStoredConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    return sanitizeConversations(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveStoredConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations.slice(0, 100)));
  } catch (err) {
    console.error("Failed to save conversations:", err);
  }
}

export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  } catch {
    return null;
  }
}

export function setActiveConversationId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  } catch {
    // ignore
  }
}

export function getCustomPersonas(): JosiePersona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PERSONAS);
    return sanitizePersonas(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function saveCustomPersonas(personas: JosiePersona[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PERSONAS, JSON.stringify(sanitizePersonas(personas)));
  } catch {
    // ignore
  }
}

export function getAllPersonas(): JosiePersona[] {
  return [...JOSIE_PERSONAS, ...getCustomPersonas()];
}

export function exportAllDataAsJson(): string {
  return JSON.stringify({
    app: "JOSIE AI Interface",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    settings: getStoredSettings(),
    conversations: getStoredConversations(),
    customPersonas: getCustomPersonas(),
  }, null, 2);
}

export function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(conversation: Conversation) {
  let md = `# ${conversation.title}\n\n`;
  md += `*Model: ${conversation.model} (${conversation.provider})*\n`;
  md += `*Created: ${new Date(conversation.createdAt).toLocaleString()}*\n\n---\n\n`;

  for (const msg of conversation.messages) {
    const roleName = msg.role === "user" ? "👤 User" : `✨ JOSIE (${msg.model || conversation.model})`;
    md += `### ${roleName}\n`;
    if (msg.thought) md += `\n> **Thought / Inner Monologue:**\n> ${msg.thought.replace(/\n/g, "\n> ")}\n\n`;
    md += `${msg.content}\n\n`;
    if (msg.metrics?.tokensPerSecond && msg.metrics.durationMs) {
      md += `*Generated in ${(msg.metrics.durationMs / 1000).toFixed(1)}s at ${msg.metrics.tokensPerSecond.toFixed(1)} tok/s*\n\n`;
    }
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${conversation.title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "josie_chat"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
