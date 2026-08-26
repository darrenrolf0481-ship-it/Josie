import React, { useRef, useEffect, useState } from "react";
import {
  Send,
  Square,
  Mic,
  MicOff,
  Sparkles,
  SlidersHorizontal,
  Paperclip,
  Wand2,
  CornerDownLeft,
  Globe,
  Zap,
} from "lucide-react";
import { AppSettings, JosiePersona } from "../types";
import { createSpeechRecognizer } from "../lib/api";

interface ChatInputAreaProps {
  input: string;
  setInput: (val: string) => void;
  isGenerating: boolean;
  onSend: () => void;
  onStop: () => void;
  settings: AppSettings;
  activePersona: JosiePersona;
  onOpenPersonaSelector: () => void;
  onOpenSettings: () => void;
  onApplyPrompt: (text: string) => void;
  onToggleWebSearch?: () => void;
  onOpenMcpHub?: () => void;
  onToggleMcp?: () => void;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  input,
  setInput,
  isGenerating,
  onSend,
  onStop,
  settings,
  activePersona,
  onOpenPersonaSelector,
  onOpenSettings,
  onApplyPrompt,
  onToggleWebSearch,
  onOpenMcpHub,
  onToggleMcp,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognizerRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220
      )}px`;
    }
  }, [input]);

  // Handle voice speech-to-text dictation
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        recognizerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    const recognizer = createSpeechRecognizer(
      (transcript, isFinal) => {
        if (isFinal) {
          setInput(input ? `${input.trim()} ${transcript}` : transcript);
        }
      },
      (err) => {
        console.warn("Speech recognition error:", err);
        setIsRecording(false);
      }
    );

    if (!recognizer) {
      alert("Speech recognition is not supported in this browser. Please use Chrome/Edge or type directly.");
      return;
    }

    recognizer.start();
    recognizerRef.current = recognizer;
    setIsRecording(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim()) {
        onSend();
      }
    }
  };

  const quickActionChips = [
    { label: "Think Step-by-Step", text: "Please think through this carefully using your internal monologue (<think> tags) before providing your synthesized answer: " },
    { label: "⚡ Run Code (MCP)", text: "Use the execute_code MCP tool function to run and test this JavaScript calculation: " },
    { label: "🖥️ System Vitals (MCP)", text: "Use the get_system_vitals MCP tool to inspect memory, uptime, and Ollama engine status." },
    { label: "Provide Clean Code", text: "Please provide a self-contained, type-safe, and production-ready implementation with error handling." },
    { label: "Explain Simply", text: "Explain this in plain, conversational language with an intuitive real-world analogy." },
  ];

  return (
    <div className="p-3 sm:p-4 bg-zinc-950/90 border-t border-zinc-850/80 backdrop-blur-md shrink-0">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Quick Action Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Wand2 className="w-3 h-3 text-emerald-400" />
            Quick:
          </span>
          {quickActionChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!input.trim()) {
                  setInput(chip.text);
                } else {
                  setInput(`${input.trim()}\n\n${chip.text}`);
                }
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[11px] whitespace-nowrap transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Text Input Card */}
        <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-emerald-500/50 shadow-lg shadow-black/40 transition-all">
          <textarea
            ref={textareaRef}
            id="input-chat-message"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activePersona.name}... (Enter to send, Shift+Enter for newline)`}
            className="w-full pl-4 pr-24 py-3 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none max-h-56 custom-scrollbar leading-relaxed"
          />

          {/* Action buttons inside input box */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            {/* Model Context Protocol (MCP) Hub Button */}
            {onOpenMcpHub && (
              <button
                id="btn-input-open-mcp-hub"
                type="button"
                onClick={onOpenMcpHub}
                className={`p-2 rounded-xl text-xs transition-all flex items-center gap-1 ${
                  settings.mcpEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-950"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
                title={
                  settings.mcpEnabled
                    ? `MCP Functions: ACTIVE (${settings.enabledMcpTools.length} Tools Enabled - Click to configure)`
                    : "Model Context Protocol (MCP) Tools: DISABLED (Click to open MCP Hub)"
                }
              >
                <Zap className={`w-4 h-4 ${settings.mcpEnabled ? "text-emerald-400" : ""}`} />
              </button>
            )}

            {/* Search Grounding Toggle Button */}
            {onToggleWebSearch && (
              <button
                id="btn-input-toggle-web-search"
                type="button"
                onClick={onToggleWebSearch}
                className={`p-2 rounded-xl text-xs transition-all flex items-center gap-1 ${
                  settings.webSearchEnabled
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs shadow-cyan-950"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
                title={
                  settings.webSearchEnabled
                    ? "Real-Time Web Search Grounding: ACTIVE (Click to disable)"
                    : "Enable Real-Time Web Search Grounding"
                }
              >
                <Globe className={`w-4 h-4 ${settings.webSearchEnabled ? "text-cyan-400" : ""}`} />
              </button>
            )}

            {/* Voice Dictation (STT) */}
            <button
              id="btn-input-voice-dictate"
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-xl text-xs transition-all ${
                isRecording
                  ? "bg-rose-500 text-zinc-950 animate-pulse shadow-md shadow-rose-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
              title={isRecording ? "Listening... (Click to stop)" : "Voice Dictation (Speech-to-Text)"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send / Stop generation */}
            {isGenerating ? (
              <button
                id="btn-input-stop-generation"
                type="button"
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold shadow-sm transition-all"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                id="btn-input-send-message"
                type="button"
                onClick={onSend}
                disabled={!input.trim()}
                className={`p-2 rounded-xl text-xs font-medium transition-all ${
                  input.trim()
                    ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-950/40"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                }`}
                title="Send Message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer Info / Hotkeys & Parameters Summary */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenPersonaSelector}
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <span className="font-medium text-zinc-400">{activePersona.name}</span>
            </button>
            <span>•</span>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-mono"
            >
              <SlidersHorizontal className="w-3 h-3 text-zinc-600" />
              <span>Temp: {settings.temperature.toFixed(2)}</span>
            </button>
            {onOpenMcpHub && (
              <>
                <span>•</span>
                <button
                  id="btn-footer-open-mcp-hub"
                  type="button"
                  onClick={onOpenMcpHub}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                    settings.mcpEnabled
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900"
                  }`}
                  title="Configure Model Context Protocol (MCP) Tools"
                >
                  <Zap className={`w-3 h-3 ${settings.mcpEnabled ? "text-emerald-400" : "text-zinc-600"}`} />
                  <span>MCP: {settings.mcpEnabled ? `${settings.enabledMcpTools.length} tools` : "OFF"}</span>
                </button>
              </>
            )}
            {onToggleWebSearch && (
              <>
                <span>•</span>
                <button
                  id="btn-footer-toggle-web-search"
                  type="button"
                  onClick={onToggleWebSearch}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                    settings.webSearchEnabled
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900"
                  }`}
                  title="Toggle Web Search Grounding"
                >
                  <Globe className={`w-3 h-3 ${settings.webSearchEnabled ? "text-cyan-400" : "text-zinc-600"}`} />
                  <span>Web Search: {settings.webSearchEnabled ? "ON" : "OFF"}</span>
                </button>
              </>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-600 font-mono">
            <span>Shift+Enter for newline</span>
            <span>•</span>
            <span>{settings.provider === "ollama" ? "Local" : "OpenRouter"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
