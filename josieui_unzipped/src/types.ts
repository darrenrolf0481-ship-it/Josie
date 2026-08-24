export type BackendProvider = "ollama" | "openrouter";

export type MessageRole = "user" | "assistant" | "system";

export interface GenerationMetrics {
  tokensPerSecond?: number;
  totalTokens?: number;
  durationMs?: number;
  evalCount?: number;
  evalDurationNs?: number;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  publishedDate?: string;
}

export type McpToolCategory =
  | "Execution"
  | "Web & Network"
  | "Workspace & Files"
  | "System Vitals"
  | "Memory & Store"
  | "DeepSeek Harness"
  | "Custom MCP";

export interface McpToolParameterProperty {
  type: string;
  description: string;
  default?: any;
  enum?: string[];
}

export interface McpTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: McpToolCategory;
  parameters: {
    type: "object";
    properties: Record<string, McpToolParameterProperty>;
    required?: string[];
  };
  enabled: boolean;
  server: string;
}

export interface McpToolCall {
  id: string;
  toolName: string;
  displayName?: string;
  args: Record<string, any>;
  status: "pending" | "running" | "success" | "error";
  result?: any;
  error?: string;
  executionTimeMs?: number;
  timestamp: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: "builtin" | "http" | "sse";
  url?: string;
  enabled: boolean;
  description: string;
  toolCount?: number;
  lastConnected?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thought?: string; // Parsed <think> or <thought> reasoning content
  timestamp: number;
  model?: string;
  provider?: BackendProvider;
  metrics?: GenerationMetrics;
  isStreaming?: boolean;
  error?: string | null;
  bookmarked?: boolean;
  searchGrounded?: boolean;
  searchQuery?: string;
  groundingSources?: GroundingSource[];
  mcpToolCalls?: McpToolCall[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  personaId?: string;
  provider: BackendProvider;
  model: string;
  pinned?: boolean;
}

export interface JosiePersona {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatarColor: string;
  systemPrompt: string;
  temperature?: number;
  topP?: number;
  isCustom?: boolean;
}

export interface AppSettings {
  provider: BackendProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  mirostat: number; // 0=off, 1=mirostat, 2=mirostat 2.0
  mirostatTau: number;
  mirostatEta: number;
  maxTokens: number;
  contextWindow: number;
  autoSpeak: boolean;
  speechVoice: string;
  speechPitch: number;
  speechRate: number;
  theme: "dark" | "light" | "cyber";
  showThoughtByDefault: boolean;
  directBrowserFetch: boolean; // if true, tries direct fetch to localhost:11434 first
  webSearchEnabled: boolean;
  searchSourcesLimit: number;
  mcpEnabled: boolean;
  mcpAutoExecute: boolean;
  enabledMcpTools: string[];
  customMcpServers: McpServerConfig[];
}

export interface OllamaModelItem {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OpenRouterModelItem {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: "Reasoning" | "Dialogue" | "Coding" | "Creative" | "Analysis";
  prompt: string;
  description: string;
  suggestedPersonaId?: string;
}
