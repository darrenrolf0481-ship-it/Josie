import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  Terminal,
  Zap,
  RotateCcw,
  BookOpen,
  Sliders,
  Server,
  Cloud,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  AppSettings,
  ChatMessage,
  Conversation,
  JosiePersona,
  McpToolCall,
  OllamaModelItem,
  OpenRouterModelItem,
} from "./types";
import {
  DEFAULT_SETTINGS,
  JOSIE_PERSONAS,
  SAMPLE_PROMPTS,
} from "./lib/constants";
import {
  getStoredSettings,
  saveStoredSettings,
  getStoredConversations,
  saveStoredConversations,
  getActiveConversationId,
  setActiveConversationId,
  getAllPersonas,
  saveCustomPersonas,
  getCustomPersonas,
} from "./lib/storage";
import {
  checkOllamaConnection,
  fetchOpenRouterModels,
  streamChatCompletion,
  executeMcpToolApi,
  TextToSpeechManager,
} from "./lib/api";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ChatMessageItem } from "./components/ChatMessageItem";
import { ChatInputArea } from "./components/ChatInputArea";
import { OllamaGuideModal } from "./components/OllamaGuideModal";
import { SettingsModal } from "./components/SettingsModal";
import { PersonaSelectorModal } from "./components/PersonaSelectorModal";
import { PromptLibraryModal } from "./components/PromptLibraryModal";
import { LiveHtmlPreviewModal } from "./components/LiveHtmlPreviewModal";
import { McpToolHubModal } from "./components/McpToolHubModal";

export default function App() {
  // App Settings & Personas State
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);
  const [personas, setPersonas] = useState<JosiePersona[]>(getAllPersonas);
  const [activePersonaId, setActivePersonaId] = useState<string>("josie-core");

  // Conversation & History State
  const [conversations, setConversations] = useState<Conversation[]>(getStoredConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(getActiveConversationId);

  // Active Chat Message Input & Streaming
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);

  // Connection & Diagnostics State
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModelItem[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelItem[]>([]);

  // UI Modals & Drawers
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOllamaGuideOpen, setIsOllamaGuideOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isMcpHubOpen, setIsMcpHubOpen] = useState(false);
  const [previewHtmlCode, setPreviewHtmlCode] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active persona object
  const activePersona =
    personas.find((p) => p.id === activePersonaId) || personas[0] || JOSIE_PERSONAS[0];

  // Active conversation object
  const currentConversation = conversations.find((c) => c.id === activeConvId);

  // Sync settings & conversations to storage
  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveStoredConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeConvId) {
      setActiveConversationId(activeConvId);
    }
  }, [activeConvId]);

  // Initial connection checks
  useEffect(() => {
    handleCheckOllama();
    fetchOpenRouterModels().then((models) => {
      if (models.length > 0) setOpenRouterModels(models);
    });
  }, [settings.ollamaBaseUrl]);

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, isGenerating]);

  // Create initial conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      handleCreateNewChat();
    } else if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, []);

  const handleCheckOllama = async () => {
    setOllamaChecking(true);
    try {
      const res = await checkOllamaConnection(settings.ollamaBaseUrl);
      setOllamaConnected(res.connected);
      if (res.models) setOllamaModels(res.models);
    } catch {
      setOllamaConnected(false);
    } finally {
      setOllamaChecking(false);
    }
  };

  const handleCreateNewChat = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: "New Conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: settings.provider,
      model:
        settings.provider === "ollama"
          ? settings.ollamaModel
          : settings.openRouterModel,
      personaId: activePersonaId,
      systemPrompt: activePersona.systemPrompt,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
  };

  const handleUpdateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv?.personaId) {
      setActivePersonaId(conv.personaId);
    }
  };

  const handleDeleteConversation = (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConvId === id) {
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        handleCreateNewChat();
      }
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const handleClearAllConversations = () => {
    setConversations([]);
    handleCreateNewChat();
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.conversations && Array.isArray(parsed.conversations)) {
          setConversations(parsed.conversations);
          if (parsed.conversations.length > 0) {
            setActiveConvId(parsed.conversations[0].id);
          }
        }
        if (parsed.settings) {
          setSettings((prev) => ({ ...prev, ...parsed.settings }));
        }
        if (parsed.customPersonas && Array.isArray(parsed.customPersonas)) {
          saveCustomPersonas(parsed.customPersonas);
          setPersonas([...JOSIE_PERSONAS, ...parsed.customPersonas]);
        }
        alert("Conversations and settings successfully imported!");
      } catch (err) {
        alert("Failed to parse JSON file. Please ensure it is a valid backup.");
      }
    };
    reader.readAsText(file);
  };

  const handleAddCustomPersona = (newPersona: JosiePersona) => {
    const custom = getCustomPersonas();
    const updated = [...custom, newPersona];
    saveCustomPersonas(updated);
    setPersonas([...JOSIE_PERSONAS, ...updated]);
  };

  const handleDeleteCustomPersona = (id: string) => {
    const custom = getCustomPersonas().filter((p) => p.id !== id);
    saveCustomPersonas(custom);
    setPersonas([...JOSIE_PERSONAS, ...custom]);
    if (activePersonaId === id) {
      setActivePersonaId("josie-core");
    }
  };

  // Main chat submission handler
  const handleSendMessage = async (userPromptText?: string) => {
    const promptToSend = (userPromptText !== undefined ? userPromptText : input).trim();
    if (!promptToSend || isGenerating) return;

    let targetConv = currentConversation;
    if (!targetConv) {
      const newId = `conv-${Date.now()}`;
      targetConv = {
        id: newId,
        title: promptToSend.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: settings.provider,
        model:
          settings.provider === "ollama"
            ? settings.ollamaModel
            : settings.openRouterModel,
        personaId: activePersonaId,
        systemPrompt: activePersona.systemPrompt,
      };
      setConversations((prev) => [targetConv!, ...prev]);
      setActiveConvId(newId);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: promptToSend,
      timestamp: Date.now(),
    };

    const assistantMessageId = `msg-${Date.now()}-asst`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      thought: "",
      timestamp: Date.now(),
      model:
        settings.provider === "ollama"
          ? settings.ollamaModel
          : settings.openRouterModel,
      provider: settings.provider,
      isStreaming: true,
      searchGrounded: settings.webSearchEnabled,
      searchQuery: settings.webSearchEnabled ? promptToSend : undefined,
      groundingSources: [],
    };

    // Update conversation title if first message
    const shouldUpdateTitle = targetConv.messages.length === 0;
    const newTitle = shouldUpdateTitle
      ? promptToSend.slice(0, 36) + (promptToSend.length > 36 ? "..." : "")
      : targetConv.title;

    const updatedMessages = [...targetConv.messages, userMessage, assistantMessage];

    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConv!.id
          ? {
              ...c,
              title: newTitle,
              updatedAt: Date.now(),
              messages: updatedMessages,
            }
          : c
      )
    );

    setInput("");
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const messagesPayload = updatedMessages
      .slice(0, -1) // exclude streaming placeholder
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await streamChatCompletion({
        messages: messagesPayload,
        settings,
        systemPrompt: activePersona.systemPrompt,
        signal: controller.signal,
        callbacks: {
          onMcpToolDetected: (detectedTools) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const existingCalls = m.mcpToolCalls || [];
                  const mergedCalls = [...existingCalls];

                  detectedTools.forEach((newCall) => {
                    const alreadyExists = mergedCalls.some(
                      (c) =>
                        c.toolName === newCall.toolName &&
                        JSON.stringify(c.args) === JSON.stringify(newCall.args)
                    );
                    if (!alreadyExists) {
                      mergedCalls.push(newCall);
                    }
                  });

                  return { ...m, mcpToolCalls: mergedCalls };
                });
                return { ...c, messages: msgs };
              })
            );

            // Auto-execute if enabled in settings
            if (settings.mcpAutoExecute) {
              detectedTools.forEach(async (toolCall) => {
                try {
                  const res = await executeMcpToolApi(toolCall.toolName, toolCall.args);
                  handleUpdateToolCall(assistantMessageId, {
                    ...toolCall,
                    status: res.success ? "success" : "error",
                    result: res.result,
                    error: res.error,
                    executionTimeMs: res.executionTimeMs,
                  });
                } catch (e: any) {
                  handleUpdateToolCall(assistantMessageId, {
                    ...toolCall,
                    status: "error",
                    error: e?.message || "Execution error",
                    executionTimeMs: 0,
                  });
                }
              });
            }
          },
          onGrounding: (groundingData) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        searchGrounded: true,
                        searchQuery: groundingData.searchQuery || promptToSend,
                        groundingSources: groundingData.sources || [],
                      }
                    : m
                );
                return { ...c, messages: msgs };
              })
            );
          },
          onChunk: (_chunk, content, thought) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content, thought, isStreaming: true }
                    : m
                );
                return { ...c, messages: msgs };
              })
            );
          },
          onMetrics: (metrics) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, metrics }
                    : m
                );
                return { ...c, messages: msgs };
              })
            );
          },
          onComplete: (content, thought, metrics) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content,
                        thought,
                        metrics,
                        isStreaming: false,
                      }
                    : m
                );
                return { ...c, messages: msgs, updatedAt: Date.now() };
              })
            );
            setIsGenerating(false);
            abortControllerRef.current = null;

            // Auto-speak if enabled
            if (settings.autoSpeak && content) {
              TextToSpeechManager.speak(content, {
                voiceName: settings.speechVoice,
                pitch: settings.speechPitch,
                rate: settings.speechRate,
                onStart: () => setCurrentlySpeakingText(content),
                onEnd: () => setCurrentlySpeakingText(null),
              });
            }
          },
          onError: (err) => {
            console.error("Chat completion stream error:", err);
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConv!.id) return c;
                const msgs = c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        isStreaming: false,
                        error: err.message,
                      }
                    : m
                );
                return { ...c, messages: msgs };
              })
            );
            setIsGenerating(false);
            abortControllerRef.current = null;
          },
        },
      });
    } catch (err: any) {
      console.error("Stream initialization error:", err);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleSpeak = (text: string) => {
    TextToSpeechManager.speak(text, {
      voiceName: settings.speechVoice,
      pitch: settings.speechPitch,
      rate: settings.speechRate,
      onStart: () => setCurrentlySpeakingText(text),
      onEnd: () => setCurrentlySpeakingText(null),
    });
  };

  const handleStopSpeaking = () => {
    TextToSpeechManager.stop();
    setCurrentlySpeakingText(null);
  };

  const handleRegenerateLast = () => {
    if (!currentConversation || currentConversation.messages.length === 0 || isGenerating)
      return;

    const messages = currentConversation.messages;
    const lastUserIdx = messages
      .map((m) => m.role)
      .lastIndexOf("user");

    if (lastUserIdx === -1) return;

    const lastUserContent = messages[lastUserIdx].content;

    // Prune up to the last user message
    const trimmed = messages.slice(0, lastUserIdx);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversation.id ? { ...c, messages: trimmed } : c
      )
    );

    handleSendMessage(lastUserContent);
  };

  const handleForkConversation = (fromMessageId: string) => {
    if (!currentConversation) return;
    const idx = currentConversation.messages.findIndex((m) => m.id === fromMessageId);
    if (idx === -1) return;

    const branchedMessages = currentConversation.messages.slice(0, idx + 1);
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      ...currentConversation,
      id: newId,
      title: `Branch: ${currentConversation.title.slice(0, 24)}`,
      messages: branchedMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
  };

  const handleEditUserMessage = (msgId: string, newContent: string) => {
    if (!currentConversation) return;
    const idx = currentConversation.messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    // Trim messages to before this user message
    const trimmed = currentConversation.messages.slice(0, idx);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversation.id ? { ...c, messages: trimmed } : c
      )
    );

    handleSendMessage(newContent);
  };

  const handleToggleBookmark = (msgId: string) => {
    if (!currentConversation) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConversation.id) return c;
        const msgs = c.messages.map((m) =>
          m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m
        );
        return { ...c, messages: msgs };
      })
    );
  };

  const handleUpdateToolCall = (msgId: string, updatedCall: McpToolCall) => {
    setConversations((prev) =>
      prev.map((c) => {
        const hasMsg = c.messages.some((m) => m.id === msgId);
        if (!hasMsg) return c;
        const msgs = c.messages.map((m) => {
          if (m.id !== msgId) return m;
          const calls = (m.mcpToolCalls || []).map((call) =>
            call.id === updatedCall.id || call.toolName === updatedCall.toolName
              ? updatedCall
              : call
          );
          return { ...m, mcpToolCalls: calls };
        });
        return { ...c, messages: msgs };
      })
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* Sidebar (Conversations & History) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConvId}
        personas={personas}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleCreateNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        onClearAll={handleClearAllConversations}
        onImportData={handleImportData}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Navigation Bar */}
        <Navbar
          settings={settings}
          activePersona={activePersona}
          ollamaConnected={ollamaConnected}
          ollamaChecking={ollamaChecking}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenOllamaGuide={() => setIsOllamaGuideOpen(true)}
          onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
          onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)}
          onOpenMcpHub={() => setIsMcpHubOpen(true)}
          onNewChat={handleCreateNewChat}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Warning Banner if Ollama is selected but not connected */}
        {settings.provider === "ollama" && !ollamaConnected && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/25 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Local Ollama is currently disconnected at{" "}
                <code className="font-mono text-amber-200">{settings.ollamaBaseUrl}</code>.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsOllamaGuideOpen(true)}
                className="underline hover:text-amber-100 text-[11px] font-medium"
              >
                How to run JOSIE
              </button>
              <button
                onClick={() => handleUpdateSettings({ provider: "openrouter" })}
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-[11px]"
              >
                Switch to OpenRouter
              </button>
            </div>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {(!currentConversation || currentConversation.messages.length === 0) ? (
            /* Welcome Empty State */
            <div className="max-w-3xl mx-auto py-8 sm:py-12 space-y-8 animate-fade-in">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-xl shadow-emerald-950/50">
                  <Sparkles className="w-8 h-8 text-zinc-950" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                  JOSIE Intelligence Studio
                </h1>
                <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                  Tailored for <code className="font-mono text-emerald-400 font-semibold">ollama run goekdenizguelmez/JOSIE</code> with natural language synthesis, deep reasoning monologue, and OpenRouter cloud integration.
                </p>
              </div>

              {/* Status & Engine Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div
                  onClick={() => setIsOllamaGuideOpen(true)}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-semibold text-xs text-zinc-200">Local Ollama Engine</h3>
                    </div>
                    {ollamaConnected ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Online
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                        Setup Guide
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Zero-latency, private inference running on your local machine with model tag <code className="text-emerald-300 font-mono">goekdenizguelmez/JOSIE</code>.
                  </p>
                </div>

                <div
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-semibold text-xs text-zinc-200">OpenRouter Integration</h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                      Cloud Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Connect via OpenRouter API key for high-throughput cloud execution, fine-tunes, and frontier reasoning models.
                  </p>
                </div>
              </div>

              {/* Sample Capability Prompts */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-medium uppercase tracking-wider text-[10px] font-mono text-zinc-500">
                    Try JOSIE Prompts
                  </span>
                  <button
                    onClick={() => setIsPromptLibraryOpen(true)}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View all prompts</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAMPLE_PROMPTS.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSendMessage(p.prompt)}
                      className="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-left transition-all group space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                          {p.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{p.category}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {p.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Message Stream */
            <div className="max-w-4xl mx-auto space-y-4">
              {currentConversation.messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  persona={personas.find((p) => p.id === currentConversation.personaId)}
                  isStreaming={message.isStreaming}
                  isSpeaking={currentlySpeakingText === message.content}
                  onSpeak={handleSpeak}
                  onStopSpeaking={handleStopSpeaking}
                  onRegenerate={
                    message.role === "assistant" &&
                    message.id === currentConversation.messages[currentConversation.messages.length - 1]?.id
                      ? handleRegenerateLast
                      : undefined
                  }
                  onEdit={
                    message.role === "user"
                      ? (newContent) => handleEditUserMessage(message.id, newContent)
                      : undefined
                  }
                  onFork={() => handleForkConversation(message.id)}
                  onToggleBookmark={() => handleToggleBookmark(message.id)}
                  onOpenPreview={(code) => setPreviewHtmlCode(code)}
                  onUpdateToolCall={(msgId, updated) => handleUpdateToolCall(msgId, updated)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <ChatInputArea
          input={input}
          setInput={setInput}
          isGenerating={isGenerating}
          onSend={() => handleSendMessage()}
          onStop={handleStopGeneration}
          settings={settings}
          activePersona={activePersona}
          onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenMcpHub={() => setIsMcpHubOpen(true)}
          onToggleMcp={() => handleUpdateSettings({ mcpEnabled: !settings.mcpEnabled })}
          onApplyPrompt={(text) => handleSendMessage(text)}
          onToggleWebSearch={() => handleUpdateSettings({ webSearchEnabled: !settings.webSearchEnabled })}
        />
      </div>

      {/* Modals & Overlays */}
      <McpToolHubModal
        isOpen={isMcpHubOpen}
        onClose={() => setIsMcpHubOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <OllamaGuideModal
        isOpen={isOllamaGuideOpen}
        onClose={() => setIsOllamaGuideOpen(false)}
        ollamaBaseUrl={settings.ollamaBaseUrl}
        onUpdateBaseUrl={(url) => handleUpdateSettings({ ollamaBaseUrl: url })}
        connected={ollamaConnected}
        checking={ollamaChecking}
        models={ollamaModels}
        onRefreshConnection={handleCheckOllama}
        onSelectModel={(model) => handleUpdateSettings({ ollamaModel: model })}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        ollamaModels={ollamaModels}
        openRouterModels={openRouterModels}
      />

      <PersonaSelectorModal
        isOpen={isPersonaSelectorOpen}
        onClose={() => setIsPersonaSelectorOpen(false)}
        personas={personas}
        activePersonaId={activePersonaId}
        onSelectPersona={(p) => setActivePersonaId(p.id)}
        onAddCustomPersona={handleAddCustomPersona}
        onDeleteCustomPersona={handleDeleteCustomPersona}
      />

      <PromptLibraryModal
        isOpen={isPromptLibraryOpen}
        onClose={() => setIsPromptLibraryOpen(false)}
        onUsePrompt={(promptText, sendNow) => {
          if (sendNow) {
            handleSendMessage(promptText);
          } else {
            setInput(promptText);
          }
        }}
      />

      <LiveHtmlPreviewModal
        isOpen={Boolean(previewHtmlCode)}
        onClose={() => setPreviewHtmlCode(null)}
        code={previewHtmlCode || ""}
      />
    </div>
  );
}
