import React from "react";
import {
  Sparkles,
  Server,
  Cloud,
  Terminal,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Plus,
  BookOpen,
  Sliders,
  CheckCircle2,
  XCircle,
  Menu,
  Globe,
  Zap,
} from "lucide-react";
import { AppSettings, JosiePersona } from "../types";

interface NavbarProps {
  settings: AppSettings;
  activePersona: JosiePersona;
  ollamaConnected: boolean;
  ollamaChecking: boolean;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenOllamaGuide: () => void;
  onOpenPersonaSelector: () => void;
  onOpenPromptLibrary: () => void;
  onOpenMcpHub?: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  activePersona,
  ollamaConnected,
  ollamaChecking,
  onUpdateSettings,
  onOpenSettings,
  onOpenOllamaGuide,
  onOpenPersonaSelector,
  onOpenPromptLibrary,
  onOpenMcpHub,
  onNewChat,
  onToggleSidebar,
}) => {
  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Sidebar toggle, Logo, Active Persona */}
      <div className="flex items-center gap-3">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          title="Toggle Chat History"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* JOSIE Brand & Persona Badge */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-md shadow-emerald-950/40">
            <Sparkles className="w-4 h-4 text-zinc-950" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 text-sm tracking-tight font-mono">
                JOSIE
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                v1.0
              </span>
            </div>
            <button
              id="btn-nav-persona-select"
              onClick={onOpenPersonaSelector}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-300 transition-colors text-left"
              title="Change JOSIE Persona & System Prompt"
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {activePersona.name}
              </span>
              <Sliders className="w-3 h-3 ml-0.5 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Center: Provider & Model Selector */}
      <div className="hidden md:flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-xl p-1 shadow-inner">
        <button
          id="btn-toggle-ollama"
          onClick={() => onUpdateSettings({ provider: "ollama" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            settings.provider === "ollama"
              ? "bg-zinc-800 text-emerald-300 shadow-sm border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Local Ollama</span>
          {ollamaChecking ? (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-1" />
          ) : ollamaConnected ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-rose-400 ml-1" />
          )}
        </button>

        <button
          id="btn-toggle-openrouter"
          onClick={() => onUpdateSettings({ provider: "openrouter" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            settings.provider === "openrouter"
              ? "bg-zinc-800 text-cyan-300 shadow-sm border border-cyan-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>OpenRouter</span>
        </button>

        <div className="h-4 w-px bg-zinc-700 mx-1" />

        <div className="px-2.5 py-1 text-xs font-mono text-zinc-300 bg-zinc-950/60 rounded-md border border-zinc-800/80 max-w-[200px] truncate">
          {settings.provider === "ollama"
            ? settings.ollamaModel
            : settings.openRouterModel}
        </div>
      </div>

      {/* Right: Actions (New Chat, Prompts, Terminal Helper, Audio, Settings) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          id="btn-nav-new-chat"
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-sm"
          title="Start New Conversation"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Session</span>
        </button>

        <button
          id="btn-nav-prompts"
          onClick={onOpenPromptLibrary}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          title="Prompt Library & Capabilities"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        <button
          id="btn-nav-ollama-guide"
          onClick={onOpenOllamaGuide}
          className={`p-2 rounded-lg transition-colors ${
            !ollamaConnected && settings.provider === "ollama"
              ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 animate-pulse"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80"
          }`}
          title="Ollama Setup & Terminal Guide"
        >
          <Terminal className="w-4 h-4" />
        </button>

        {onOpenMcpHub && (
          <button
            id="btn-nav-mcp-hub"
            onClick={onOpenMcpHub}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs ${
              settings.mcpEnabled
                ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-xs"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            }`}
            title={`Model Context Protocol (MCP) Hub - ${settings.mcpEnabled ? `${settings.enabledMcpTools.length} Tools Enabled` : "Disabled (Click to configure)"}`}
          >
            <Zap className={`w-4 h-4 ${settings.mcpEnabled ? "text-emerald-400" : ""}`} />
          </button>
        )}

        <button
          id="btn-nav-toggle-web-search"
          onClick={() => onUpdateSettings({ webSearchEnabled: !settings.webSearchEnabled })}
          className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs ${
            settings.webSearchEnabled
              ? "text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
          }`}
          title={settings.webSearchEnabled ? "Web Search Grounding: ACTIVE (Click to toggle)" : "Web Search Grounding: OFF (Click to enable)"}
        >
          <Globe className={`w-4 h-4 ${settings.webSearchEnabled ? "text-cyan-400" : ""}`} />
        </button>

        <button
          id="btn-nav-toggle-audio"
          onClick={() => onUpdateSettings({ autoSpeak: !settings.autoSpeak })}
          className={`p-2 rounded-lg transition-colors ${
            settings.autoSpeak
              ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
          }`}
          title={settings.autoSpeak ? "Voice Auto-Read: ON" : "Voice Auto-Read: OFF"}
        >
          {settings.autoSpeak ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        <button
          id="btn-nav-settings"
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          title="Sampling & Generation Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
