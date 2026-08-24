import React, { useState } from "react";
import {
  Terminal,
  Calculator,
  Globe,
  FolderCode,
  FileCode,
  Activity,
  Database,
  Layers,
  ChevronDown,
  ChevronRight,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { McpToolCall } from "../types";
import { executeMcpToolApi } from "../lib/api";

interface McpToolCallCardProps {
  toolCall: McpToolCall;
  onUpdateToolCall?: (updated: McpToolCall) => void;
}

export const McpToolCallCard: React.FC<McpToolCallCardProps> = ({
  toolCall,
  onUpdateToolCall,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(toolCall.status === "running");
  const [copied, setCopied] = useState(false);

  const getToolIcon = (name: string) => {
    switch (name) {
      case "execute_code":
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case "calculate_math":
        return <Calculator className="w-4 h-4 text-amber-400" />;
      case "fetch_url":
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case "list_workspace_files":
        return <FolderCode className="w-4 h-4 text-blue-400" />;
      case "read_workspace_file":
        return <FileCode className="w-4 h-4 text-indigo-400" />;
      case "get_system_vitals":
        return <Activity className="w-4 h-4 text-purple-400" />;
      case "mcp_keyval_get":
      case "mcp_keyval_set":
      case "mcp_keyval_list":
        return <Database className="w-4 h-4 text-teal-400" />;
      case "deepseek_harness_status":
        return <Layers className="w-4 h-4 text-rose-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
  };

  const handleExecute = async () => {
    setIsRunning(true);
    const updatedPending: McpToolCall = {
      ...toolCall,
      status: "running",
    };
    onUpdateToolCall?.(updatedPending);

    try {
      const res = await executeMcpToolApi(toolCall.toolName, toolCall.args);
      const finishedCall: McpToolCall = {
        ...toolCall,
        status: res.success ? "success" : "error",
        result: res.result,
        error: res.error,
        executionTimeMs: res.executionTimeMs,
      };
      onUpdateToolCall?.(finishedCall);
    } catch (err: any) {
      const failedCall: McpToolCall = {
        ...toolCall,
        status: "error",
        error: err?.message || "Execution failed",
        executionTimeMs: 0,
      };
      onUpdateToolCall?.(failedCall);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyResult = () => {
    const textToCopy = toolCall.result
      ? typeof toolCall.result === "string"
        ? toolCall.result
        : JSON.stringify(toolCall.result, null, 2)
      : toolCall.error || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2.5 rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-sm overflow-hidden text-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="p-1 rounded-md bg-zinc-800 border border-zinc-700/60 flex items-center justify-center">
            {getToolIcon(toolCall.toolName)}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono font-bold text-zinc-100 tracking-tight">
              {toolCall.toolName}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20 uppercase tracking-wider">
              MCP Function
            </span>
          </div>

          {/* Status Badge */}
          {toolCall.status === "success" && (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{toolCall.executionTimeMs ? `${toolCall.executionTimeMs}ms` : "Executed"}</span>
            </span>
          )}

          {toolCall.status === "error" && (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-950/60 text-rose-300 border border-rose-500/30 text-[10px] font-mono">
              <XCircle className="w-3 h-3 text-rose-400" />
              <span>Failed</span>
            </span>
          )}

          {toolCall.status === "running" && (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30 text-[10px] font-mono animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>Running...</span>
            </span>
          )}

          {toolCall.status === "pending" && (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-mono">
              <Clock className="w-3 h-3" />
              <span>Ready</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Action Button: Run / Re-run */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={isRunning}
            className={`px-2 py-1 rounded-lg font-mono text-[11px] flex items-center gap-1 transition-all ${
              toolCall.status === "pending"
                ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-xs"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
            } disabled:opacity-50`}
            title={toolCall.status === "pending" ? "Execute MCP Tool" : "Re-run MCP Tool"}
          >
            {isRunning ? (
              <RotateCw className="w-3 h-3 animate-spin" />
            ) : toolCall.status === "pending" ? (
              <Play className="w-3 h-3 fill-current" />
            ) : (
              <RotateCw className="w-3 h-3" />
            )}
            <span>{toolCall.status === "pending" ? "Execute" : "Re-run"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Card Body */}
      {isOpen && (
        <div className="p-3 space-y-2.5 bg-zinc-950 font-mono text-[11px]">
          {/* Arguments Panel */}
          <div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Input Parameters</span>
            </div>
            <pre className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-zinc-300 overflow-x-auto custom-scrollbar font-mono leading-relaxed max-h-40">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Result Output Panel */}
          {(toolCall.result !== undefined || toolCall.error) && (
            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Output Result</span>
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {toolCall.error ? (
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 overflow-x-auto custom-scrollbar">
                  <strong>Error:</strong> {toolCall.error}
                </div>
              ) : (
                <pre className="p-2.5 rounded-lg bg-emerald-950/15 border border-emerald-500/20 text-emerald-200 overflow-x-auto custom-scrollbar font-mono leading-relaxed max-h-56">
                  {typeof toolCall.result === "string"
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
