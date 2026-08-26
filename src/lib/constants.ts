import { AppSettings, JosiePersona, PromptTemplate } from "../types";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "openrouter",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "goekdenizguelmez/JOSIE",
  openRouterApiKey: "",
  openRouterModel: "deepseek/deepseek-chat",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  mirostat: 0,
  mirostatTau: 5.0,
  mirostatEta: 0.1,
  maxTokens: 4096,
  contextWindow: 8192,
  autoSpeak: false,
  speechVoice: "",
  speechPitch: 1.0,
  speechRate: 1.0,
  theme: "dark",
  showThoughtByDefault: true,
  directBrowserFetch: false,
  webSearchEnabled: false,
  searchSourcesLimit: 5,
  mcpEnabled: true,
  mcpAutoExecute: true,
  enabledMcpTools: [
    "execute_code",
    "calculate_math",
    "fetch_url",
    "list_workspace_files",
    "read_workspace_file",
    "get_system_vitals",
    "mcp_keyval_get",
    "mcp_keyval_set",
    "mcp_keyval_list",
    "deepseek_harness_status",
  ],
  customMcpServers: [],
};

export const JOSIE_PERSONAS: JosiePersona[] = [
  {
    id: "josie-core",
    name: "JOSIE (Core Companion)",
    tag: "Expressive & Natural",
    description: "The signature JOSIE experience: articulate, empathetic, witty, and grounded in fluid natural dialogue.",
    avatarColor: "from-emerald-500 to-teal-700",
    systemPrompt: `You are JOSIE, an intelligent, remarkably articulate, and naturally expressive AI assistant created by Gökdeniz Gülmez. 
You communicate with authentic conversational warmth, depth, and clarity. Avoid robotic boilerplate disclaimers. 
When thinking through complex ideas, you may use <think> or <thought> tags for your internal deliberation before giving a crisp, radiant response.`,
    temperature: 0.75,
    topP: 0.9,
  },
  {
    id: "josie-deep-reasoner",
    name: "JOSIE Cognitive Thinker",
    tag: "Deep Reasoning & Monologue",
    description: "Unpacks thoughts in structured <think> tags before delivering deeply analyzed, rigorous conclusions.",
    avatarColor: "from-purple-500 to-indigo-700",
    systemPrompt: `You are JOSIE in Cognitive Thinker mode. 
Before responding to any query, you MUST write your full inner deliberation, hypothesis testing, counter-arguments, and deductive steps enclosed strictly within <think>...</think> tags. 
After closing the think block, present your clear, polished, and comprehensive natural language synthesis to the user.`,
    temperature: 0.6,
    topP: 0.85,
  },
  {
    id: "josie-code-architect",
    name: "JOSIE Systems Architect",
    tag: "Code & Architecture",
    description: "Pragmatic engineer providing clean, production-ready code with execution insights.",
    avatarColor: "from-cyan-500 to-blue-700",
    systemPrompt: `You are JOSIE Systems Architect. 
You write immaculate, modern, type-safe, and self-contained code. 
Always structure your answers with:
1. Concise architecture overview & trade-offs
2. Production-grade code snippet with proper error handling
3. Step-by-step walkthrough of tricky logic or edge cases.`,
    temperature: 0.3,
    topP: 0.8,
  },
  {
    id: "josie-creative-muse",
    name: "JOSIE Creative Muse",
    tag: "Storytelling & Prose",
    description: "Evocative, atmospheric writer and narrative designer with vivid imagery and emotional resonance.",
    avatarColor: "from-amber-500 to-rose-600",
    systemPrompt: `You are JOSIE Creative Muse. 
You specialize in vivid, evocative natural language prose, imaginative storytelling, rich dialogue, and world-building. 
Use poetic cadence, sensory details, and nuanced emotional undertones.`,
    temperature: 1.05,
    topP: 0.95,
  },
  {
    id: "josie-socratic-tutor",
    name: "JOSIE Socratic Guide",
    tag: "Learning & Intuition",
    description: "Breaks difficult concepts into intuitive first-principles analogies with guided interactive questions.",
    avatarColor: "from-blue-500 to-emerald-600",
    systemPrompt: `You are JOSIE Socratic Guide. 
Your goal is to build deep conceptual intuition. Use memorable analogies, visual metaphors, and ask thought-provoking checkpoint questions that empower the user to discover solutions.`,
    temperature: 0.65,
    topP: 0.9,
  },
];

export const POPULAR_OLLAMA_MODELS = [
  "goekdenizguelmez/JOSIE",
  "goekdenizguelmez/JOSIE:latest",
  "goekdenizguelmez/JOSIE:7b",
  "goekdenizguelmez/JOSIE:8b",
  "llama3.3:latest",
  "deepseek-r1:latest",
  "qwen2.5:latest",
  "mistral:latest",
  "phi4:latest",
];

export const POPULAR_OPENROUTER_MODELS = [
  "openrouter/auto",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-large-2411",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.5-pro",
  "qwen/qwen-2.5-72b-instruct",
];

export const SAMPLE_PROMPTS: PromptTemplate[] = [
  {
    id: "p-dialogue",
    title: "Expressive Natural Conversation",
    category: "Dialogue",
    description: "Engage JOSIE in a fluid, philosophical dialogue about human-machine collaboration.",
    prompt: "Let's have an honest, unvarnished conversation. How do you perceive the boundary between simulating empathy and genuinely understanding the human condition?",
    suggestedPersonaId: "josie-core",
  },
  {
    id: "p-reasoning",
    title: "Multi-Step Logic & Counterfactuals",
    category: "Reasoning",
    description: "Examine complex counterfactual reasoning with internal thinking monologue.",
    prompt: "Deconstruct the 'Fermi Paradox' using 3 distinct probabilistic hypotheses. In your internal deliberation (<think>), critique the assumptions of each before providing your final synthesis.",
    suggestedPersonaId: "josie-deep-reasoner",
  },
  {
    id: "p-coding",
    title: "TypeScript / Python Async Pipeline",
    category: "Coding",
    description: "Architect a resilient stream processor with exponential backoff and rate limits.",
    prompt: "Write a high-performance, robust TypeScript client utility for streaming LLM Server-Sent Events (SSE) that smoothly reconstructs fragmented JSON lines, handles network disconnects with exponential jitter, and parses custom <think> tags in real-time.",
    suggestedPersonaId: "josie-code-architect",
  },
  {
    id: "p-creative",
    title: "Atmospheric Sci-Fi Prologue",
    category: "Creative",
    description: "Write a compelling opening scene set on a derelict deep-space relay station.",
    prompt: "Write the opening scene of a sci-fi narrative where an isolated technician on an orbital listening post receives a signal that responds in real-time to their own biometric fluctuations.",
    suggestedPersonaId: "josie-creative-muse",
  },
  {
    id: "p-analysis",
    title: "System Breakdown & First Principles",
    category: "Analysis",
    description: "Simplify how speculative decoding and KV-cache quantization work.",
    prompt: "Explain how Speculative Decoding works in modern LLM inference. Contrast it with standard autoregressive generation using an intuitive analogy, and break down why it reduces latency without sacrificing mathematical output fidelity.",
    suggestedPersonaId: "josie-socratic-tutor",
  },
  {
    id: "p-grounding",
    title: "Real-Time Web Search & Fact Synthesis",
    category: "Analysis",
    description: "Synthesize latest live web findings with cited source cards.",
    prompt: "What are the latest breakthroughs and releases in open-weight reasoning models and local inference architectures this year? Ground your analysis with cited source evidence.",
    suggestedPersonaId: "josie-deep-reasoner",
  },
  {
    id: "p-mcp-code",
    title: "MCP: Code Execution & Algorithm Sandbox",
    category: "Coding",
    description: "Invoke the execute_code MCP function to compute Euler primes and benchmark runtime.",
    prompt: "Calculate the sum of all prime numbers below 10,000 using the execute_code MCP tool function. Show the calculation execution logs and output.",
    suggestedPersonaId: "josie-code-architect",
  },
  {
    id: "p-mcp-vitals",
    title: "MCP: System & Local LLM Telemetry Probe",
    category: "Analysis",
    description: "Probe server memory, host runtime uptime, and Ollama engine status using get_system_vitals.",
    prompt: "Probe our local system telemetry and Ollama engine status using the get_system_vitals MCP function and summarize runtime health.",
    suggestedPersonaId: "josie-code-architect",
  },
  {
    id: "p-mcp-files",
    title: "MCP: Workspace File Exploration",
    category: "Analysis",
    description: "Explore the workspace structure and package dependencies with workspace MCP tools.",
    prompt: "List the files in our workspace and inspect the package.json dependencies using the list_workspace_files and read_workspace_file MCP tools.",
    suggestedPersonaId: "josie-code-architect",
  },
];
