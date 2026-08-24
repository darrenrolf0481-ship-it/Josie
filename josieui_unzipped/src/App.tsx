import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { AppSettings, JosiePersona, OllamaModelItem, OpenRouterModelItem } from "./types";
import { DEFAULT_SETTINGS, JOSIE_PERSONAS, SAMPLE_PROMPTS } from "./lib/constants";
import {
  getStoredSettings,
  saveStoredSettings,
  getAllPersonas,
  saveCustomPersonas,
  getCustomPersonas,
  sanitizeConversations,
  sanitizePersonas,
  sanitizeSettings,
} from "./lib/storage";
import { checkOllamaConnection, fetchOpenRouterModels } from "./lib/api";
import { useConversations } from "./hooks/useConversations";
import { useModals } from "./hooks/useModals";
import { useChat } from "./hooks/useChat";
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
  // Settings & Personas
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);
  const [personas, setPersonas] = useState<JosiePersona[]>(getAllPersonas);
  const [activePersonaId, setActivePersonaId] = useState<string>("josie-core");

  // Conversations
  const {
    conversations,
    activeConversation,
    createNewChat,
    resetConversations,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePin,
    clearAllConversations,
    updateConversationMessages,
    updateConversation,
    addConversation,
    overwriteConversations,
  } = useConversations(settings);

  // Modals
  const modals = useModals();

  // Chat
  const chat = useChat({
    settings,
    activePersonaId,
    activePersonaSystemPrompt:
      personas.find((p) => p.id === activePersonaId)?.systemPrompt ??
      JOSIE_PERSONAS[0].systemPrompt,
    updateConversationMessages,
    updateConversation: (convId, patch) => {
      updateConversation(convId, patch);
    },
    addConversation,
    getActiveConversation: () => activeConversation,
  });

  // Connection state
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModelItem[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<
    OpenRouterModelItem[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active persona
  const activePersona =
    personas.find((p) => p.id === activePersonaId) ??
    personas[0] ??
    JOSIE_PERSONAS[0];

  // Sync settings to localStorage
  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  // Initial connection checks
  useEffect(() => {
    handleCheckOllama();
    fetchOpenRouterModels().then((models) => {
      if (models.length > 0) setOpenRouterModels(models);
    });
  }, [settings.ollamaBaseUrl]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, chat.isGenerating]);

  // Restore persona from selected conversation
  useEffect(() => {
    if (activeConversation?.personaId) {
      setActivePersonaId(activeConversation.personaId);
    }
  }, [activeConversation?.id]);

  // Handlers
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

  const handleUpdateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleCreateNewChat = () => {
    createNewChat(activePersonaId, activePersona.systemPrompt);
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv?.personaId) {
      setActivePersonaId(conv.personaId);
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
  };

  const handleClearAllConversations = () => {
    resetConversations(activePersonaId, activePersona.systemPrompt);
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.conversations && Array.isArray(parsed.conversations)) {
          overwriteConversations(sanitizeConversations(parsed.conversations));
        }
        if (parsed.settings) {
          setSettings(sanitizeSettings({ ...settings, ...parsed.settings }));
        }
        if (parsed.customPersonas && Array.isArray(parsed.customPersonas)) {
          const importedPersonas = sanitizePersonas(parsed.customPersonas);
          saveCustomPersonas(importedPersonas);
          setPersonas([...JOSIE_PERSONAS, ...importedPersonas]);
        }
        alert("Conversations and settings successfully imported!");
      } catch {
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <Sidebar
        isOpen={modals.isSidebarOpen}
        onClose={modals.closeSidebar}
        conversations={conversations}
        activeConversationId={activeConversation?.id ?? null}
        personas={personas}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleCreateNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={renameConversation}
        onTogglePin={togglePin}
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
          onOpenSettings={modals.openSettings}
          onOpenOllamaGuide={modals.openOllamaGuide}
          onOpenPersonaSelector={modals.openPersonaSelector}
          onOpenPromptLibrary={modals.openPromptLibrary}
          onOpenMcpHub={modals.openMcpHub}
          onNewChat={handleCreateNewChat}
          onToggleSidebar={modals.toggleSidebar}
        />

        {/* Warning Banner */}
        {settings.provider === "ollama" && !ollamaConnected && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/25 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Local Ollama is currently disconnected at{" "}
                <code className="font-mono text-amber-200">
                  {settings.ollamaBaseUrl}
                </code>
                .
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={modals.openOllamaGuide}
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
          {!activeConversation ||
          activeConversation.messages.length === 0 ? (
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
                  Tailored for{" "}
                  <code className="font-mono text-emerald-400 font-semibold">
                    ollama run goekdenizguelmez/JOSIE
                  </code>{" "}
                  with natural language synthesis, deep reasoning monologue, and
                  OpenRouter cloud integration.
                </p>
              </div>

              {/* Status & Engine Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div
                  onClick={modals.openOllamaGuide}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-semibold text-xs text-zinc-200">
                        Local Ollama Engine
                      </h3>
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
                    Zero-latency, private inference running on your local
                    machine with model tag{" "}
                    <code className="text-emerald-300 font-mono">
                      goekdenizguelmez/JOSIE
                    </code>
                    .
                  </p>
                </div>

                <div
                  onClick={modals.openSettings}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-semibold text-xs text-zinc-200">
                        OpenRouter Integration
                      </h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                      Cloud Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Connect via OpenRouter API key for high-throughput cloud
                    execution, fine-tunes, and frontier reasoning models.
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
                    onClick={modals.openPromptLibrary}
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
                      onClick={() => chat.sendMessage(p.prompt)}
                      className="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-left transition-all group space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                          {p.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {p.category}
                        </span>
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
              {activeConversation.messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  persona={personas.find(
                    (p) => p.id === activeConversation.personaId
                  )}
                  isStreaming={message.isStreaming}
                  isSpeaking={chat.currentlySpeakingText === message.content}
                  onSpeak={chat.speak}
                  onStopSpeaking={chat.stopSpeaking}
                  onRegenerate={
                    message.role === "assistant" &&
                    message.id ===
                      activeConversation.messages[
                        activeConversation.messages.length - 1
                      ]?.id
                      ? chat.handleRegenerateLast
                      : undefined
                  }
                  onEdit={
                    message.role === "user"
                      ? (newContent) =>
                          chat.editUserMessage(message.id, newContent)
                      : undefined
                  }
                  onFork={() => chat.forkConversation(message.id)}
                  onToggleBookmark={() => chat.toggleBookmark(message.id)}
                  onOpenPreview={(code) => modals.openPreview(code)}
                  onUpdateToolCall={(msgId, updated) =>
                    chat.updateToolCall(
                      msgId,
                      updated,
                      activeConversation.id
                    )
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <ChatInputArea
          input={chat.input}
          setInput={chat.setInput}
          isGenerating={chat.isGenerating}
          onSend={() => chat.sendMessage()}
          onStop={chat.stopGeneration}
          settings={settings}
          activePersona={activePersona}
          onOpenPersonaSelector={modals.openPersonaSelector}
          onOpenSettings={modals.openSettings}
          onOpenMcpHub={modals.openMcpHub}
          onToggleMcp={() =>
            handleUpdateSettings({ mcpEnabled: !settings.mcpEnabled })
          }
          onApplyPrompt={(text) => chat.sendMessage(text)}
          onToggleWebSearch={() =>
            handleUpdateSettings({
              webSearchEnabled: !settings.webSearchEnabled,
            })
          }
        />
      </div>

      {/* Modals */}
      <McpToolHubModal
        isOpen={modals.isMcpHubOpen}
        onClose={modals.closeMcpHub}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <OllamaGuideModal
        isOpen={modals.isOllamaGuideOpen}
        onClose={modals.closeOllamaGuide}
        ollamaBaseUrl={settings.ollamaBaseUrl}
        onUpdateBaseUrl={(url) => handleUpdateSettings({ ollamaBaseUrl: url })}
        connected={ollamaConnected}
        checking={ollamaChecking}
        models={ollamaModels}
        onRefreshConnection={handleCheckOllama}
        onSelectModel={(model) => handleUpdateSettings({ ollamaModel: model })}
      />

      <SettingsModal
        isOpen={modals.isSettingsOpen}
        onClose={modals.closeSettings}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        ollamaModels={ollamaModels}
        openRouterModels={openRouterModels}
      />

      <PersonaSelectorModal
        isOpen={modals.isPersonaSelectorOpen}
        onClose={modals.closePersonaSelector}
        personas={personas}
        activePersonaId={activePersonaId}
        onSelectPersona={(p) => setActivePersonaId(p.id)}
        onAddCustomPersona={handleAddCustomPersona}
        onDeleteCustomPersona={handleDeleteCustomPersona}
      />

      <PromptLibraryModal
        isOpen={modals.isPromptLibraryOpen}
        onClose={modals.closePromptLibrary}
        onUsePrompt={(promptText, sendNow) => {
          if (sendNow) {
            chat.sendMessage(promptText);
          } else {
            chat.setInput(promptText);
          }
        }}
      />

      <LiveHtmlPreviewModal
        isOpen={Boolean(modals.previewHtmlCode)}
        onClose={modals.closePreview}
        code={modals.previewHtmlCode || ""}
      />
    </div>
  );
}