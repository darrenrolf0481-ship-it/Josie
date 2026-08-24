import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  User,
  Brain,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Edit3,
  GitBranch,
  Bookmark,
  BookmarkCheck,
  Zap,
  Clock,
  Eye,
  Terminal,
  Globe,
  ExternalLink,
  Search,
} from "lucide-react";
import { ChatMessage, JosiePersona, McpToolCall } from "../types";
import { McpToolCallCard } from "./McpToolCallCard";

interface ChatMessageItemProps {
  message: ChatMessage;
  persona?: JosiePersona;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onFork?: () => void;
  onToggleBookmark?: () => void;
  onOpenPreview?: (htmlCode: string) => void;
  onUpdateToolCall?: (messageId: string, updatedCall: McpToolCall) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  persona,
  isStreaming,
  isSpeaking,
  onSpeak,
  onStopSpeaking,
  onRegenerate,
  onEdit,
  onFork,
  onToggleBookmark,
  onOpenPreview,
  onUpdateToolCall,
}) => {
  const [showThought, setShowThought] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editedText, setEditedText] = useState(message.content);

  const isUser = message.role === "user";
  const hasGrounding = !isUser && (message.searchGrounded || (message.groundingSources && message.groundingSources.length > 0));

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedText.trim() && onEdit) {
      onEdit(editedText.trim());
      setIsEditingUser(false);
    }
  };

  return (
    <div
      className={`group relative py-4 px-3 sm:px-5 rounded-2xl transition-all ${
        isUser
          ? "bg-zinc-900/60 border border-zinc-800/80 ml-4 sm:ml-12"
          : "bg-zinc-950/80 border border-zinc-850/80 mr-2 sm:mr-8 shadow-xs"
      }`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          {isUser ? (
            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <User className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              className={`w-6 h-6 rounded-lg bg-gradient-to-br ${
                persona?.avatarColor || "from-emerald-400 to-teal-600"
              } flex items-center justify-center text-zinc-950 shadow-xs`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              {isUser ? "You" : persona?.name || "JOSIE"}
            </span>

            {!isUser && message.model && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                {message.model}
              </span>
            )}

            <span className="text-[10px] text-zinc-600">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Generation Performance Stats (Tokens/sec, Duration) */}
        {!isUser && message.metrics && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 bg-zinc-900/70 border border-zinc-800/80 px-2 py-0.5 rounded-md">
            {message.metrics.tokensPerSecond ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-2.5 h-2.5" />
                {message.metrics.tokensPerSecond.toFixed(1)} tok/s
              </span>
            ) : null}
            {message.metrics.durationMs ? (
              <span className="flex items-center gap-1 text-zinc-400">
                <Clock className="w-2.5 h-2.5" />
                {(message.metrics.durationMs / 1000).toFixed(1)}s
              </span>
            ) : null}
            {message.metrics.totalTokens ? (
              <span className="text-zinc-500">
                {message.metrics.totalTokens} tokens
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Thought / Inner Monologue Accordion (Reasoning) */}
      {!isUser && message.thought && (
        <div className="mb-3 rounded-xl border border-purple-500/20 bg-purple-950/20 overflow-hidden">
          <button
            onClick={() => setShowThought(!showThought)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-purple-300/90 hover:bg-purple-900/20 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono text-[11px] font-medium tracking-wide uppercase">
                Thought Process & Inner Monologue
              </span>
              {isStreaming && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping ml-1" />
              )}
            </div>
            {showThought ? (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
            )}
          </button>

          {showThought && (
            <div className="px-3.5 py-2.5 border-t border-purple-500/15 bg-zinc-950/60 text-xs text-purple-200/80 font-mono leading-relaxed whitespace-pre-wrap selection:bg-purple-800/40 custom-scrollbar max-h-72 overflow-y-auto">
              {message.thought}
            </div>
          )}
        </div>
      )}

      {/* Real-time Search Grounding Sources Accordion */}
      {hasGrounding && (
        <div className="mb-3 rounded-xl border border-cyan-500/25 bg-cyan-950/20 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowSources(!showSources)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-900/25 transition-colors"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono text-[11px] font-semibold tracking-wide uppercase text-cyan-200">
                Web Search Grounded
              </span>
              {message.groundingSources && message.groundingSources.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                  {message.groundingSources.length} sources
                </span>
              )}
              {message.searchQuery && (
                <span className="text-[10px] font-mono text-cyan-400/80 truncate max-w-[200px] sm:max-w-xs">
                  "{message.searchQuery}"
                </span>
              )}
              {isStreaming && (!message.groundingSources || message.groundingSources.length === 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-1" />
              )}
            </div>
            {showSources ? (
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />
            )}
          </button>

          {showSources && (
            <div className="px-3 py-2.5 border-t border-cyan-500/20 bg-zinc-950/70 space-y-2">
              {message.groundingSources && message.groundingSources.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {message.groundingSources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/source p-2.5 rounded-lg bg-zinc-900/80 hover:bg-cyan-950/40 border border-zinc-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold flex items-center justify-center border border-cyan-500/30">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-medium text-zinc-200 group-hover/source:text-cyan-200 truncate">
                            {source.title || source.domain || "Web Source"}
                          </span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-zinc-500 group-hover/source:text-cyan-400 shrink-0 transition-colors" />
                      </div>

                      {source.snippet && (
                        <p className="text-[11px] text-zinc-400/90 line-clamp-2 leading-relaxed font-sans">
                          {source.snippet}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 group-hover/source:text-cyan-400/80 pt-0.5">
                        <span className="truncate">{source.domain || "internet"}</span>
                        <span className="text-[9px] uppercase tracking-wider opacity-70">verified</span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-cyan-300/80 font-mono py-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Searching live web sources for "{message.searchQuery || "query"}"...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Model Context Protocol (MCP) Tool Invocations */}
      {message.mcpToolCalls && message.mcpToolCalls.length > 0 && (
        <div className="my-2.5 space-y-2">
          {message.mcpToolCalls.map((toolCall) => (
            <McpToolCallCard
              key={toolCall.id}
              toolCall={toolCall}
              onUpdateToolCall={(updated) => onUpdateToolCall?.(message.id, updated)}
            />
          ))}
        </div>
      )}

      {/* Message Body */}
      {isUser && isEditingUser ? (
        <form onSubmit={handleSaveEdit} className="mt-2 space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full p-2 rounded-lg bg-zinc-950 border border-emerald-500/50 text-xs text-zinc-100 focus:outline-hidden resize-y min-h-[70px]"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingUser(false)}
              className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded text-xs bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400"
            >
              Save & Branch
            </button>
          </div>
        </form>
      ) : (
        <div className="text-zinc-200 text-[13.5px] leading-relaxed prose prose-invert max-w-none prose-p:my-2 prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");
                  const lang = match ? match[1] : "";
                  const isHtmlOrSvg = ["html", "svg", "xml"].includes(lang.toLowerCase());

                  if (!inline) {
                    return (
                      <div className="my-3 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden not-prose shadow-inner">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                          <span className="flex items-center gap-1.5 text-zinc-300 font-semibold uppercase">
                            <Terminal className="w-3 h-3 text-emerald-400" />
                            {lang || "code"}
                          </span>
                          <div className="flex items-center gap-2">
                            {isHtmlOrSvg && onOpenPreview && (
                              <button
                                type="button"
                                onClick={() => onOpenPreview(codeStr)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-800 text-cyan-400 hover:text-cyan-300 transition-colors"
                                title="Live Preview Render"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            )}
                            <CopyCodeButton code={codeStr} />
                          </div>
                        </div>
                        <pre className="p-3 text-xs font-mono text-emerald-200/90 overflow-x-auto selection:bg-emerald-950/70">
                          <code>{children}</code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code
                      className="px-1.5 py-0.5 rounded-md bg-zinc-850 text-emerald-300 font-mono text-xs border border-zinc-750 font-normal"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5 py-1 text-zinc-500 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Generating response...</span>
            </div>
          ) : null}

          {/* Streaming Cursor */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 translate-y-0.5 animate-pulse" />
          )}

          {message.error && (
            <div className="mt-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 text-xs text-rose-300">
              <p className="font-semibold mb-0.5">Generation Encountered an Error:</p>
              <p>{message.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="mt-3 pt-2 border-t border-zinc-850/60 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          {/* TTS Audio button */}
          <button
            onClick={() => {
              if (isSpeaking) {
                onStopSpeaking();
              } else {
                onSpeak(message.content);
              }
            }}
            className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${
              isSpeaking ? "text-emerald-400 bg-emerald-500/10" : "hover:text-zinc-300"
            }`}
            title={isSpeaking ? "Stop Speaking" : "Read Aloud (TTS)"}
          >
            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Copy Full Message */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
            title="Copy Message Text"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Bookmark */}
          {onToggleBookmark && (
            <button
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${
                message.bookmarked ? "text-amber-400" : "hover:text-zinc-300"
              }`}
              title={message.bookmarked ? "Remove Bookmark" : "Save Bookmark"}
            >
              {message.bookmarked ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* User Edit */}
          {isUser && onEdit && (
            <button
              onClick={() => setIsEditingUser(true)}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              title="Edit & Fork Prompt"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Assistant Regenerate & Fork */}
          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              title="Regenerate Response"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {onFork && (
            <button
              onClick={onFork}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              title="Branch Conversation from here"
            >
              <GitBranch className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-[10px] text-zinc-600 font-mono">
          {message.content.length > 0 && `${message.content.split(/\s+/).filter(Boolean).length} words`}
        </div>
      </div>
    </div>
  );
};

const CopyCodeButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      title="Copy code"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400 text-[10px]">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span className="text-[10px]">Copy</span>
        </>
      )}
    </button>
  );
};
