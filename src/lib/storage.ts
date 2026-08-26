import { AppSettings, Conversation, JosiePersona } from "../types";
import { DEFAULT_SETTINGS, JOSIE_PERSONAS } from "./constants";

const STORAGE_KEYS = {
  SETTINGS: "josie_settings_v1",
  CONVERSATIONS: "josie_conversations_v1",
  ACTIVE_CONVERSATION_ID: "josie_active_conv_id",
  CUSTOM_PERSONAS: "josie_custom_personas_v1",
};

export function getStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

export function getStoredConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
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

export function setActiveConversationId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
  } catch {
    // ignore
  }
}

export function getCustomPersonas(): JosiePersona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PERSONAS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomPersonas(personas: JosiePersona[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PERSONAS, JSON.stringify(personas));
  } catch {
    // ignore
  }
}

export function getAllPersonas(): JosiePersona[] {
  const custom = getCustomPersonas();
  return [...JOSIE_PERSONAS, ...custom];
}

export function exportAllDataAsJson(): string {
  const data = {
    app: "JOSIE AI Interface",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    settings: getStoredSettings(),
    conversations: getStoredConversations(),
    customPersonas: getCustomPersonas(),
  };
  return JSON.stringify(data, null, 2);
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
    if (msg.thought) {
      md += `\n> **Thought / Inner Monologue:**\n> ${msg.thought.replace(/\n/g, "\n> ")}\n\n`;
    }
    md += `${msg.content}\n\n`;
    if (msg.metrics?.tokensPerSecond) {
      md += `*Generated in ${(msg.metrics.durationMs! / 1000).toFixed(1)}s at ${msg.metrics.tokensPerSecond.toFixed(1)} tok/s*\n\n`;
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
