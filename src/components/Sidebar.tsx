import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Pin,
  Download,
  Upload,
  X,
  Bot,
  Layers,
  Sparkles,
} from "lucide-react";
import { Conversation, JosiePersona } from "../types";
import { downloadMarkdown, downloadJson, exportAllDataAsJson } from "../lib/storage";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  personas: JosiePersona[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  onClearAll: () => void;
  onImportData: (file: File) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  personas,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onClearAll,
  onImportData,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinned = filteredConversations.filter((c) => c.pinned);
  const unpinned = filteredConversations.filter((c) => !c.pinned);

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleExportBackup = () => {
    const jsonStr = exportAllDataAsJson();
    downloadJson(jsonStr, `josie_conversations_backup_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportData(file);
      e.target.value = "";
    }
  };

  const getPersonaName = (personaId?: string) => {
    if (!personaId) return "JOSIE";
    const found = personas.find((p) => p.id === personaId);
    return found ? found.name : "JOSIE";
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-zinc-950 border-r border-zinc-850 flex flex-col transition-transform duration-200 ease-in-out shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-72"
        }`}
      >
        {/* Top: New Chat & Search */}
        <div className="p-3.5 border-b border-zinc-850 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-medium text-zinc-300 tracking-wide uppercase">
                Conversations
              </span>
            </div>
            <button
              id="btn-close-sidebar-mobile"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            id="btn-sidebar-new-chat"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat Session</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="input-sidebar-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Middle: Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Bot className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-medium">No saved conversations yet</p>
              <p className="text-[11px] text-zinc-600 mt-1">Start a dialogue with JOSIE to begin</p>
            </div>
          ) : (
            <>
              {/* Pinned Section */}
              {pinned.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 mb-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    <Pin className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Pinned</span>
                  </div>
                  <div className="space-y-1">
                    {pinned.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConversationId}
                        personaName={getPersonaName(conv.personaId)}
                        isEditing={editingId === conv.id}
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        onSaveRename={(e) => handleSaveRename(conv.id, e)}
                        onStartRename={(e) => startRename(conv, e)}
                        onSelect={() => {
                          onSelectConversation(conv.id);
                          if (window.innerWidth < 768) onClose();
                        }}
                        onDelete={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        onTogglePin={(e) => {
                          e.stopPropagation();
                          onTogglePin(conv.id);
                        }}
                        onExport={(e) => {
                          e.stopPropagation();
                          downloadMarkdown(conv);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Section */}
              <div>
                {pinned.length > 0 && (
                  <div className="px-2 mb-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    <span>Recent Chats</span>
                  </div>
                )}
                <div className="space-y-1">
                  {unpinned.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      personaName={getPersonaName(conv.personaId)}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      onSaveRename={(e) => handleSaveRename(conv.id, e)}
                      onStartRename={(e) => startRename(conv, e)}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        if (window.innerWidth < 768) onClose();
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      onTogglePin={(e) => {
                        e.stopPropagation();
                        onTogglePin(conv.id);
                      }}
                      onExport={(e) => {
                        e.stopPropagation();
                        downloadMarkdown(conv);
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom: Import / Export / Clear */}
        <div className="p-3 border-t border-zinc-850 bg-zinc-950/60 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              id="btn-sidebar-export-all"
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium border border-zinc-800 transition-colors"
              title="Backup all chats as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>

            <label
              htmlFor="file-import-chats"
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium border border-zinc-800 transition-colors cursor-pointer"
              title="Import JSON backup"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input
                id="file-import-chats"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {conversations.length > 0 && (
            <button
              id="btn-sidebar-clear-all"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete all conversations?")) {
                  onClearAll();
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] text-zinc-600 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear chat history</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  personaName: string;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSaveRename: (e: React.FormEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conv,
  isActive,
  personaName,
  isEditing,
  editTitle,
  setEditTitle,
  onSaveRename,
  onStartRename,
  onSelect,
  onDelete,
  onTogglePin,
  onExport,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all ${
        isActive
          ? "bg-zinc-850/90 text-zinc-100 border border-zinc-700/60 shadow-xs"
          : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
        <MessageSquare
          className={`w-3.5 h-3.5 shrink-0 ${
            isActive ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400"
          }`}
        />

        {isEditing ? (
          <form onSubmit={onSaveRename} className="flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={onSaveRename}
              autoFocus
              className="w-full bg-zinc-900 border border-emerald-500/50 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-hidden"
            />
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-snug">{conv.title}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mt-0.5">
              <span>{new Date(conv.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              <span>•</span>
              <span className="truncate">{personaName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons on hover */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onTogglePin}
            className={`p-1 rounded hover:bg-zinc-800 ${
              conv.pinned ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
            title={conv.pinned ? "Unpin chat" : "Pin chat"}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={onExport}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Export as Markdown"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={onStartRename}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Rename chat"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"
            title="Delete chat"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
