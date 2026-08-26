import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Server,
  Cloud,
  Volume2,
  Cpu,
  Layers,
  Key,
  Shield,
  RotateCcw,
  Sparkles,
  Play,
  Globe,
  Search,
  ExternalLink,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { AppSettings, GroundingSource, OllamaModelItem, OpenRouterModelItem } from "../types";
import {
  POPULAR_OLLAMA_MODELS,
  POPULAR_OPENROUTER_MODELS,
  DEFAULT_SETTINGS,
} from "../lib/constants";
import { TextToSpeechManager, querySearchGrounding } from "../lib/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  ollamaModels: OllamaModelItem[];
  openRouterModels: OpenRouterModelItem[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  ollamaModels,
  openRouterModels,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<"provider" | "sampling" | "voice" | "grounding" | "mcp" | "advanced">("provider");
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // State for search test in settings
  const [testQuery, setTestQuery] = useState("Latest discoveries in quantum computing");
  const [isSearching, setIsSearching] = useState(false);
  const [testSources, setTestSources] = useState<GroundingSource[] | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  useEffect(() => {
    const updateVoices = () => {
      const v = TextToSpeechManager.getVoices();
      setSystemVoices(v);
    };
    updateVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  if (!isOpen) return null;

  const handleUpdate = (patch: Partial<AppSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all settings to default values?")) {
      setLocalSettings(DEFAULT_SETTINGS);
    }
  };

  const testVoice = () => {
    TextToSpeechManager.speak(
      "Hello! I am JOSIE. My natural language synthesis is online and tuned to your preferences.",
      {
        voiceName: localSettings.speechVoice,
        pitch: localSettings.speechPitch,
        rate: localSettings.speechRate,
      }
    );
  };

  const handleRunSearchTest = async () => {
    if (!testQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await querySearchGrounding(testQuery.trim(), localSettings.searchSourcesLimit || 5);
      setTestSources(res.sources || []);
    } catch (e) {
      console.error("Search test failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Playground & Inference Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Configure dual Ollama/OpenRouter backends and sampling parameters
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-zinc-850 bg-zinc-950">
          <button
            onClick={() => setActiveTab("provider")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "provider"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Engines & Models</span>
          </button>

          <button
            onClick={() => setActiveTab("sampling")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "sampling"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Sampling & Sampling</span>
          </button>

          <button
            onClick={() => setActiveTab("voice")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "voice"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voice & Audio</span>
          </button>

          <button
            onClick={() => setActiveTab("grounding")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "grounding"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Web Search Grounding</span>
          </button>

          <button
            onClick={() => setActiveTab("mcp")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "mcp"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>MCP Tool Calling</span>
          </button>

          <button
            onClick={() => setActiveTab("advanced")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
              activeTab === "advanced"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Advanced & Display</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {/* TAB 1: Provider */}
          {activeTab === "provider" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Active Backend Engine
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => handleUpdate({ provider: "ollama" })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      localSettings.provider === "ollama"
                        ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-zinc-100">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span>Local Ollama</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Runs locally on your GPU/CPU via <code className="text-emerald-300 font-mono">ollama run goekdenizguelmez/JOSIE</code>
                    </p>
                  </div>

                  <div
                    onClick={() => handleUpdate({ provider: "openrouter" })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      localSettings.provider === "openrouter"
                        ? "bg-cyan-950/30 border-cyan-500/50 text-cyan-300"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-zinc-100">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      <span>OpenRouter Cloud</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Cloud inference API connecting to JOSIE and 200+ frontier LLMs
                    </p>
                  </div>
                </div>
              </div>

              {/* Ollama Config Section */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    Ollama Configuration
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Ollama Base URL
                  </label>
                  <input
                    type="text"
                    value={localSettings.ollamaBaseUrl}
                    onChange={(e) => handleUpdate({ ollamaBaseUrl: e.target.value })}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-hidden focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Ollama Model Tag
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={localSettings.ollamaModel}
                      onChange={(e) => handleUpdate({ ollamaModel: e.target.value })}
                      placeholder="goekdenizguelmez/JOSIE"
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300 focus:outline-hidden focus:border-emerald-500/50"
                    />

                    {/* Quick popular model badges */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {POPULAR_OLLAMA_MODELS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleUpdate({ ollamaModel: m })}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            localSettings.ollamaModel === m
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-850"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* OpenRouter Config Section */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                    OpenRouter Configuration
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Key className="w-3 h-3 text-cyan-400" />
                      OpenRouter API Key
                    </span>
                    <span className="text-[10px] text-zinc-500">Stored safely in browser</span>
                  </label>
                  <input
                    type="password"
                    value={localSettings.openRouterApiKey}
                    onChange={(e) => handleUpdate({ openRouterApiKey: e.target.value })}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-hidden focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    OpenRouter Model
                  </label>
                  <input
                    type="text"
                    value={localSettings.openRouterModel}
                    onChange={(e) => handleUpdate({ openRouterModel: e.target.value })}
                    placeholder="openrouter/auto"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-cyan-300 focus:outline-hidden focus:border-cyan-500/50"
                  />

                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {POPULAR_OPENROUTER_MODELS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleUpdate({ openRouterModel: m })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          localSettings.openRouterModel === m
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-850"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Sampling Parameters */}
          {activeTab === "sampling" && (
            <div className="space-y-4">
              {/* Temperature */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200">Temperature</span>
                    <p className="text-[11px] text-zinc-500">Controls creativity and variety</p>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-950 text-emerald-300 border border-zinc-800">
                    {localSettings.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={localSettings.temperature}
                  onChange={(e) => handleUpdate({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                  <span>0.0 (Precise / Code)</span>
                  <span>0.7 (Balanced)</span>
                  <span>1.5+ (Creative Prose)</span>
                </div>
              </div>

              {/* Top-P & Top-K */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Top-P (Nucleus)</span>
                    <span className="font-mono text-xs text-emerald-300">
                      {localSettings.topP.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localSettings.topP}
                    onChange={(e) => handleUpdate({ topP: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Top-K</span>
                    <span className="font-mono text-xs text-emerald-300">
                      {localSettings.topK}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={localSettings.topK}
                    onChange={(e) => handleUpdate({ topK: parseInt(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Repeat Penalty & Context Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Repeat Penalty</span>
                    <span className="font-mono text-xs text-emerald-300">
                      {localSettings.repeatPenalty.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.05"
                    value={localSettings.repeatPenalty}
                    onChange={(e) => handleUpdate({ repeatPenalty: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                  <span className="font-semibold text-zinc-200">Context Window (Tokens)</span>
                  <select
                    value={localSettings.contextWindow}
                    onChange={(e) => handleUpdate({ contextWindow: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-hidden"
                  >
                    <option value={2048}>2,048 Tokens</option>
                    <option value={4096}>4,096 Tokens</option>
                    <option value={8192}>8,192 Tokens (Recommended)</option>
                    <option value={16384}>16,384 Tokens</option>
                    <option value={32768}>32,768 Tokens</option>
                    <option value={65536}>65,536 Tokens</option>
                  </select>
                </div>
              </div>

              {/* Mirostat Sampling */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200">Mirostat Sampling</span>
                    <p className="text-[11px] text-zinc-500">
                      Dynamic perplexity control algorithm
                    </p>
                  </div>
                  <select
                    value={localSettings.mirostat}
                    onChange={(e) => handleUpdate({ mirostat: parseInt(e.target.value) })}
                    className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300 focus:outline-hidden"
                  >
                    <option value={0}>Disabled (Default)</option>
                    <option value={1}>Mirostat 1.0</option>
                    <option value={2}>Mirostat 2.0</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Voice & Audio */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-zinc-200">Auto-Read Responses</span>
                      <p className="text-[11px] text-zinc-500">Automatically speak JOSIE replies out loud</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSpeak}
                    onChange={(e) => handleUpdate({ autoSpeak: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <label className="block text-xs font-semibold text-zinc-200">
                  Select Speech Synthesis Voice
                </label>
                <select
                  value={localSettings.speechVoice}
                  onChange={(e) => handleUpdate({ speechVoice: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden"
                >
                  <option value="">Default System Voice</option>
                  {systemVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Rate (Speed)</span>
                      <span className="font-mono">{localSettings.speechRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={localSettings.speechRate}
                      onChange={(e) => handleUpdate({ speechRate: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Pitch</span>
                      <span className="font-mono">{localSettings.speechPitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={localSettings.speechPitch}
                      onChange={(e) => handleUpdate({ speechPitch: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={testVoice}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-medium"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Voice Preview</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Web Search Grounding */}
          {activeTab === "grounding" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-zinc-100">Default Web Search Grounding</span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Automatically retrieve and inject live, verified web search context into user prompts before streaming responses.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.webSearchEnabled}
                  onChange={(e) => handleUpdate({ webSearchEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer shrink-0 ml-3"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200">Max Search Sources</span>
                    <p className="text-[11px] text-zinc-500">Number of top web results and snippets to extract</p>
                  </div>
                  <span className="font-mono text-cyan-400 font-semibold text-xs px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
                    {localSettings.searchSourcesLimit || 5} sources
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={localSettings.searchSourcesLimit || 5}
                  onChange={(e) => handleUpdate({ searchSourcesLimit: parseInt(e.target.value) || 5 })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>1 (Lightweight)</span>
                  <span>5 (Recommended)</span>
                  <span>10 (Comprehensive)</span>
                </div>
              </div>

              {/* Real-time Search Grounding Test Utility */}
              <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Live Search Retriever Test</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Instant Verification</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Enter search test query..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleRunSearchTest}
                    disabled={isSearching || !testQuery.trim()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isSearching ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3 h-3" />
                        <span>Test Retriever</span>
                      </>
                    )}
                  </button>
                </div>

                {testSources !== null && (
                  <div className="pt-2 space-y-2 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">
                        Retrieved <strong className="text-cyan-300">{testSources.length}</strong> sources:
                      </span>
                      {testSources.length > 0 && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3" /> Grounding Ready
                        </span>
                      )}
                    </div>

                    {testSources.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic">No search results found for this query.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {testSources.map((source, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-left space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-zinc-200 truncate">
                                [{idx + 1}] {source.title}
                              </span>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {source.snippet && (
                              <p className="text-[11px] text-zinc-400 line-clamp-2">{source.snippet}</p>
                            )}
                            <div className="text-[9px] font-mono text-zinc-500">{source.domain}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Model Context Protocol (MCP) */}
          {activeTab === "mcp" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200">Enable Model Context Protocol (MCP)</span>
                  <p className="text-[11px] text-zinc-500">
                    Injects active tool schemas into system instructions so models can execute functions
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.mcpEnabled}
                  onChange={(e) => handleUpdate({ mcpEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200">Auto-Execute MCP Invocations</span>
                  <p className="text-[11px] text-zinc-500">
                    Immediately executes tool calls detected during chat streaming without requiring manual click
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.mcpAutoExecute}
                  onChange={(e) => handleUpdate({ mcpAutoExecute: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">Active MCP Tools Enabled</span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {localSettings.enabledMcpTools.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "execute_code", label: "JavaScript Sandbox (VM)" },
                    { id: "calculate_math", label: "Precise Math Evaluator" },
                    { id: "fetch_url", label: "Web URL Fetcher" },
                    { id: "list_workspace_files", label: "List Workspace Files" },
                    { id: "read_workspace_file", label: "Read Workspace File" },
                    { id: "get_system_vitals", label: "System Vitals & RAM" },
                    { id: "mcp_keyval_set", label: "Key-Value Store (Set)" },
                    { id: "mcp_keyval_get", label: "Key-Value Store (Get)" },
                    { id: "mcp_keyval_list", label: "Key-Value Store (List)" },
                    { id: "deepseek_harness_status", label: "DeepSeek Harness" },
                  ].map((item) => {
                    const isChecked = localSettings.enabledMcpTools.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...localSettings.enabledMcpTools, item.id]
                              : localSettings.enabledMcpTools.filter((id) => id !== item.id);
                            handleUpdate({ enabledMcpTools: next });
                          }}
                          className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                        />
                        <span className="text-zinc-300 font-mono text-[11px] truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Advanced & Display */}
          {activeTab === "advanced" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200">Expand Thoughts by Default</span>
                  <p className="text-[11px] text-zinc-500">
                    Automatically expand the &lt;think&gt; reasoning accordion when generating
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.showThoughtByDefault}
                  onChange={(e) => handleUpdate({ showThoughtByDefault: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200">Direct Browser Fetch to Ollama</span>
                  <p className="text-[11px] text-zinc-500">
                    If running locally with OLLAMA_ORIGINS="*" enabled
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.directBrowserFetch}
                  onChange={(e) => handleUpdate({ directBrowserFetch: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              id="btn-save-settings"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold shadow-md shadow-emerald-950/40"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
