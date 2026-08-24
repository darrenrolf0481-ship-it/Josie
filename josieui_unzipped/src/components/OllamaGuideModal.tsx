import React, { useState } from "react";
import {
  Terminal,
  Copy,
  Check,
  X,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Layers,
  Cpu,
} from "lucide-react";
import { OllamaModelItem } from "../types";

interface OllamaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  ollamaBaseUrl: string;
  onUpdateBaseUrl: (url: string) => void;
  connected: boolean;
  checking: boolean;
  models: OllamaModelItem[];
  onRefreshConnection: () => void;
  onSelectModel: (modelName: string) => void;
}

export const OllamaGuideModal: React.FC<OllamaGuideModalProps> = ({
  isOpen,
  onClose,
  ollamaBaseUrl,
  onUpdateBaseUrl,
  connected,
  checking,
  models,
  onRefreshConnection,
  onSelectModel,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Ollama Local Setup & JOSIE Runner
              </h2>
              <p className="text-xs text-zinc-400">
                Run <code className="font-mono text-emerald-300">goekdenizguelmez/JOSIE</code> locally on your GPU/CPU
              </p>
            </div>
          </div>
          <button
            id="btn-close-ollama-guide"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Connection Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              connected
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/30 border-amber-500/30 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-zinc-100">
                  {connected
                    ? "Connected to Local Ollama"
                    : "Ollama Not Detected at Endpoint"}
                </p>
                <p className="text-[11px] opacity-80">
                  Endpoint: <span className="font-mono">{ollamaBaseUrl}</span>
                </p>
              </div>
            </div>

            <button
              id="btn-ollama-guide-refresh"
              onClick={onRefreshConnection}
              disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 font-medium text-xs shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
              <span>Test Ping</span>
            </button>
          </div>

          {/* Step 1: Run JOSIE Command */}
          <div className="space-y-2">
            <h3 className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-mono">
                1
              </span>
              Run JOSIE via Ollama CLI
            </h3>
            <p className="text-zinc-400 leading-relaxed">
              Open your terminal or command prompt and run the following command to download and run the JOSIE model:
            </p>
            <div className="relative group rounded-xl bg-zinc-900 border border-zinc-800 p-3 font-mono text-emerald-300 text-xs flex items-center justify-between">
              <code>ollama run goekdenizguelmez/JOSIE</code>
              <button
                onClick={() => copyToClipboard("ollama run goekdenizguelmez/JOSIE", "cmd1")}
                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]"
              >
                {copiedCmd === "cmd1" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === "cmd1" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Enable CORS if needed */}
          <div className="space-y-2">
            <h3 className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-mono">
                2
              </span>
              CORS Configuration (For Web Browsers)
            </h3>
            <p className="text-zinc-400 leading-relaxed">
              If Ollama blocks incoming browser requests due to CORS, start Ollama with origins allowed:
            </p>
            <div className="space-y-1.5">
              <div className="relative group rounded-xl bg-zinc-900 border border-zinc-800 p-3 font-mono text-zinc-300 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-500"># macOS / Linux:</span>
                  <p className="text-emerald-300 mt-0.5">OLLAMA_ORIGINS="*" ollama serve</p>
                </div>
                <button
                  onClick={() => copyToClipboard('OLLAMA_ORIGINS="*" ollama serve', "cmd2")}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]"
                >
                  {copiedCmd === "cmd2" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === "cmd2" ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="relative group rounded-xl bg-zinc-900 border border-zinc-800 p-3 font-mono text-zinc-300 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-500"># Windows PowerShell:</span>
                  <p className="text-emerald-300 mt-0.5">$env:OLLAMA_ORIGINS="*"; ollama serve</p>
                </div>
                <button
                  onClick={() => copyToClipboard('$env:OLLAMA_ORIGINS="*"; ollama serve', "cmd3")}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]"
                >
                  {copiedCmd === "cmd3" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === "cmd3" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Installed Models list */}
          {connected && models.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-850">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                Detected Local Models on Your Machine ({models.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {models.map((m) => (
                  <div
                    key={m.name}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-mono text-xs font-semibold text-zinc-200 truncate">{m.name}</p>
                      {m.size && (
                        <p className="text-[10px] text-zinc-500">
                          Size: {(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        onSelectModel(m.name);
                        onClose();
                      }}
                      className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-mono shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Powered by Ollama API & Gökdeniz Gülmez's JOSIE
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
