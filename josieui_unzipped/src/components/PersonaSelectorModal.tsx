import React, { useState } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
  Check,
  Brain,
  Code2,
  Palette,
  BookOpen,
  UserCheck,
} from "lucide-react";
import { JosiePersona } from "../types";

interface PersonaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: JosiePersona[];
  activePersonaId: string;
  onSelectPersona: (persona: JosiePersona) => void;
  onAddCustomPersona: (persona: JosiePersona) => void;
  onDeleteCustomPersona: (id: string) => void;
}

export const PersonaSelectorModal: React.FC<PersonaSelectorModalProps> = ({
  isOpen,
  onClose,
  personas,
  activePersonaId,
  onSelectPersona,
  onAddCustomPersona,
  onDeleteCustomPersona,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temp, setTemp] = useState(0.7);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    const newPersona: JosiePersona = {
      id: `custom-persona-${Date.now()}`,
      name: name.trim(),
      tag: tag.trim() || "Custom Persona",
      description: description.trim() || "User defined custom JOSIE system persona",
      avatarColor: "from-fuchsia-500 to-pink-700",
      systemPrompt: systemPrompt.trim(),
      temperature: temp,
      isCustom: true,
    };

    onAddCustomPersona(newPersona);
    onSelectPersona(newPersona);
    setIsCreating(false);
    setName("");
    setTag("");
    setDescription("");
    setSystemPrompt("");
  };

  const getPersonaIcon = (id: string) => {
    if (id.includes("reasoner") || id.includes("thinker")) return <Brain className="w-4 h-4" />;
    if (id.includes("code") || id.includes("architect")) return <Code2 className="w-4 h-4" />;
    if (id.includes("creative") || id.includes("muse")) return <Palette className="w-4 h-4" />;
    if (id.includes("tutor") || id.includes("socratic")) return <BookOpen className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                JOSIE Personas & System Directives
              </h2>
              <p className="text-xs text-zinc-400">
                Choose specialized natural language personas or define custom system behavior
              </p>
            </div>
          </div>
          <button
            id="btn-close-personas"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {!isCreating ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-300">
                  Available JOSIE Modes ({personas.length})
                </span>
                <button
                  id="btn-create-persona-toggle"
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Persona</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {personas.map((p) => {
                  const isSelected = p.id === activePersonaId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPersona(p);
                        onClose();
                      }}
                      className={`relative p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all group ${
                        isSelected
                          ? "bg-zinc-900 border-emerald-500/50 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg bg-gradient-to-br ${p.avatarColor} flex items-center justify-center text-zinc-950 shadow-xs`}
                            >
                              {getPersonaIcon(p.id)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-zinc-100 leading-tight">
                                {p.name}
                              </h3>
                              <span className="text-[10px] text-emerald-400 font-mono">
                                {p.tag}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 mb-2">
                          {p.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Rec. Temp: {p.temperature ?? 0.7}</span>
                        {p.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomPersona(p.id);
                            }}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete custom persona"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <h3 className="font-semibold text-zinc-200 text-xs">
                  Create Custom JOSIE Persona
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Back to List
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Persona Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. JOSIE Medical Analyst"
                  required
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Tag / Subtitle
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. Clinical Insights & Research"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Brief Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Analyzes medical case studies with first principles logic"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  System Prompt (Instructions for JOSIE)
                </label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are JOSIE in specialized mode. Respond with..."
                  required
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50 font-mono leading-relaxed resize-y"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Recommended Temperature</span>
                  <span className="font-mono text-emerald-300">{temp.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={temp}
                  onChange={(e) => setTemp(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                >
                  Save Persona
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Current: <span className="text-zinc-300">{personas.find((p) => p.id === activePersonaId)?.name}</span>
          </span>
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
