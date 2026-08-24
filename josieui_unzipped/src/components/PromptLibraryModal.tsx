import React, { useState } from "react";
import {
  X,
  BookOpen,
  Send,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Brain,
  Code,
  Palette,
  MessageCircle,
  BarChart2,
} from "lucide-react";
import { PromptTemplate } from "../types";
import { SAMPLE_PROMPTS } from "../lib/constants";

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsePrompt: (promptText: string, sendImmediately: boolean) => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  onUsePrompt,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ["All", "Dialogue", "Reasoning", "Coding", "Creative", "Analysis"];

  const filteredPrompts =
    selectedCategory === "All"
      ? SAMPLE_PROMPTS
      : SAMPLE_PROMPTS.filter((p) => p.category === selectedCategory);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Reasoning":
        return <Brain className="w-3.5 h-3.5 text-purple-400" />;
      case "Coding":
        return <Code className="w-3.5 h-3.5 text-cyan-400" />;
      case "Creative":
        return <Palette className="w-3.5 h-3.5 text-amber-400" />;
      case "Dialogue":
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <BarChart2 className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                JOSIE Prompt Library & Capability Demos
              </h2>
              <p className="text-xs text-zinc-400">
                Curated prompt starters tailored to JOSIE's reasoning and dialogue engine
              </p>
            </div>
          </div>
          <button
            id="btn-close-prompts"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-zinc-850 bg-zinc-950 overflow-x-auto custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-zinc-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Prompts Grid */}
        <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar text-xs">
          {filteredPrompts.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-zinc-800">
                    {getCategoryIcon(item.category)}
                  </span>
                  <h3 className="font-semibold text-zinc-200">{item.title}</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-850">
                  {item.category}
                </span>
              </div>

              <p className="text-zinc-400 text-[11px] leading-relaxed">
                {item.description}
              </p>

              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850/80 font-mono text-[11px] text-emerald-300/90 leading-relaxed">
                "{item.prompt}"
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(item.prompt, item.id)}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === item.id ? "Copied" : "Copy text"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onUsePrompt(item.prompt, false);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[11px] font-medium transition-colors"
                  >
                    Insert in Input
                  </button>
                  <button
                    onClick={() => {
                      onUsePrompt(item.prompt, true);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-semibold transition-colors shadow-xs"
                  >
                    <span>Send Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
