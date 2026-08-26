import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Terminal,
  Calculator,
  Globe,
  FolderCode,
  FileCode,
  Activity,
  Database,
  Layers,
  Search,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  RotateCw,
  ExternalLink,
  Sliders,
  Server,
  Info,
  X,
  Check,
  Zap,
} from "lucide-react";
import { AppSettings, McpServerConfig, McpTool, McpToolCategory } from "../types";
import { executeMcpToolApi, fetchMcpTools, testCustomMcpServerApi } from "../lib/api";

interface McpToolHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const McpToolHubModal: React.FC<McpToolHubModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [activeTab, setActiveTab] = useState<"catalog" | "servers" | "docs">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Interactive Tool Test Playground state
  const [testingTool, setTestingTool] = useState<McpTool | null>(null);
  const [testArgsInput, setTestArgsInput] = useState<string>("{}");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Custom Server state
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerType, setNewServerType] = useState<"http" | "sse">("http");
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverTestResult, setServerTestResult] = useState<{
    connected?: boolean;
    error?: string;
    toolCount?: number;
    responseTimeMs?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTools();
    }
  }, [isOpen]);

  const loadTools = async () => {
    const loaded = await fetchMcpTools();
    setTools(loaded);
  };

  if (!isOpen) return null;

  const categories: Array<string> = [
    "All",
    "Execution",
    "Web & Network",
    "Workspace & Files",
    "System Vitals",
    "Memory & Store",
    "DeepSeek Harness",
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isToolEnabled = (toolName: string) => {
    return settings.enabledMcpTools.includes(toolName);
  };

  const toggleTool = (toolName: string) => {
    const isCurrentlyEnabled = isToolEnabled(toolName);
    let updated: string[];
    if (isCurrentlyEnabled) {
      updated = settings.enabledMcpTools.filter((name) => name !== toolName);
    } else {
      updated = [...settings.enabledMcpTools, toolName];
    }
    onUpdateSettings({ enabledMcpTools: updated });
  };

  const handleEnableAll = () => {
    const allNames = tools.map((t) => t.name);
    onUpdateSettings({ enabledMcpTools: allNames });
  };

  const handleDisableAll = () => {
    onUpdateSettings({ enabledMcpTools: [] });
  };

  const handleOpenToolTester = (tool: McpTool) => {
    setTestingTool(tool);
    setTestResult(null);

    // Build default arguments template from parameter properties
    const defaultArgs: Record<string, any> = {};
    if (tool.parameters?.properties) {
      Object.entries(tool.parameters.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          defaultArgs[key] = prop.default;
        } else if (prop.type === "string") {
          defaultArgs[key] =
            key === "code"
              ? "const x = 42; return x * 2;"
              : key === "expression"
              ? "Math.sqrt(256) + 40"
              : key === "url"
              ? "https://jsonplaceholder.typicode.com/todos/1"
              : key === "filePath"
              ? "package.json"
              : key === "key"
              ? "my_variable"
              : "";
        } else if (prop.type === "number") {
          defaultArgs[key] = 100;
        } else if (prop.type === "boolean") {
          defaultArgs[key] = true;
        }
      });
    }
    setTestArgsInput(JSON.stringify(defaultArgs, null, 2));
  };

  const handleRunToolTest = async () => {
    if (!testingTool) return;
    setTestRunning(true);
    setTestResult(null);

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(testArgsInput);
    } catch {
      setTestResult({
        success: false,
        error: "Invalid JSON format in arguments editor.",
        executionTimeMs: 0,
      });
      setTestRunning(false);
      return;
    }

    try {
      const res = await executeMcpToolApi(testingTool.name, parsedArgs);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || "Execution error",
        executionTimeMs: 0,
      });
    } finally {
      setTestRunning(false);
    }
  };

  const handleAddCustomServer = () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    const newServer: McpServerConfig = {
      id: `server-${Date.now()}`,
      name: newServerName.trim(),
      url: newServerUrl.trim(),
      type: newServerType,
      enabled: true,
      description: `Custom ${newServerType.toUpperCase()} MCP endpoint`,
      lastConnected: Date.now(),
    };

    const updated = [...(settings.customMcpServers || []), newServer];
    onUpdateSettings({ customMcpServers: updated });
    setNewServerName("");
    setNewServerUrl("");
    setServerTestResult(null);
  };

  const handleTestServer = async () => {
    if (!newServerUrl.trim()) return;
    setIsTestingServer(true);
    setServerTestResult(null);
    try {
      const res = await testCustomMcpServerApi(newServerUrl.trim());
      setServerTestResult(res);
    } catch (err: any) {
      setServerTestResult({
        connected: false,
        error: err?.message || "Test failed",
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleRemoveCustomServer = (id: string) => {
    const updated = (settings.customMcpServers || []).filter((s) => s.id !== id);
    onUpdateSettings({ customMcpServers: updated });
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  Model Context Protocol (MCP) Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                  {settings.enabledMcpTools.length} Active Tools
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Execute client/server tool capabilities, file operations, and sandboxes directly within JOSIE conversations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global MCP Switches & Tab Bar */}
        <div className="px-6 py-2.5 border-b border-zinc-800/80 bg-zinc-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "catalog"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Tools Catalog ({tools.length})
            </button>
            <button
              onClick={() => setActiveTab("servers")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "servers"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              MCP Servers ({settings.customMcpServers?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "docs"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Protocol Specs
            </button>
          </div>

          {/* Quick Settings */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={settings.mcpEnabled}
                onChange={(e) => onUpdateSettings({ mcpEnabled: e.target.checked })}
                className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="font-medium">Enable MCP in Prompts</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={settings.mcpAutoExecute}
                onChange={(e) => onUpdateSettings({ mcpAutoExecute: e.target.checked })}
                className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="font-medium">Auto-Execute Calls</span>
            </label>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* TAB 1: Tools Catalog */}
          {activeTab === "catalog" && (
            <div className="space-y-4">
              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search MCP tools by name, description, or parameter..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-800/60 pb-2">
                <span>
                  Showing {filteredTools.length} of {tools.length} available MCP tools
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEnableAll}
                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Enable All
                  </button>
                  <span>•</span>
                  <button
                    onClick={handleDisableAll}
                    className="text-rose-400 hover:text-rose-300 font-medium"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {/* Tool Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTools.map((tool) => {
                  const enabled = isToolEnabled(tool.name);
                  return (
                    <div
                      key={tool.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        enabled
                          ? "bg-zinc-900/70 border-emerald-500/30 shadow-xs"
                          : "bg-zinc-900/30 border-zinc-800/80 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60">
                              {getToolIcon(tool.name)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-zinc-100 text-xs flex items-center gap-1.5">
                                <span>{tool.displayName}</span>
                                <span className="text-[10px] font-mono text-zinc-500 font-normal">
                                  ({tool.name})
                                </span>
                              </h3>
                              <span className="text-[10px] font-mono text-emerald-400/90 uppercase tracking-wider">
                                {tool.category}
                              </span>
                            </div>
                          </div>

                          {/* Toggle Checkbox */}
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleTool(tool.name)}
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0 mt-0.5"
                          />
                        </div>

                        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {Object.keys(tool.parameters?.properties || {}).length} params
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenToolTester(tool)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-colors border border-zinc-700/60"
                          >
                            <Play className="w-3 h-3 text-emerald-400" />
                            <span>Test Tool</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTools.length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No MCP tools matching your filter criteria.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Custom MCP Servers */}
          {activeTab === "servers" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-semibold text-zinc-200 text-xs">Connect Custom MCP Server</h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">JSON-RPC 2.0 / SSE</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Server Label</label>
                    <input
                      type="text"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      placeholder="e.g. GitHub MCP Server"
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-400 mb-1">Endpoint URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newServerUrl}
                        onChange={(e) => setNewServerUrl(e.target.value)}
                        placeholder="https://mcp-server.internal/v1 or http://localhost:8080/mcp"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                      />
                      <button
                        type="button"
                        onClick={handleTestServer}
                        disabled={isTestingServer || !newServerUrl.trim()}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        {isTestingServer ? (
                          <RotateCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>Ping</span>
                      </button>
                    </div>
                  </div>
                </div>

                {serverTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-mono border ${
                      serverTestResult.connected
                        ? "bg-emerald-950/20 text-emerald-300 border-emerald-500/30"
                        : "bg-rose-950/20 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {serverTestResult.connected ? (
                      <div>
                        ✅ Connected successfully! Discovered {serverTestResult.toolCount} tools in{" "}
                        {serverTestResult.responseTimeMs}ms.
                      </div>
                    ) : (
                      <div>❌ Connection failed: {serverTestResult.error}</div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddCustomServer}
                    disabled={!newServerName.trim() || !newServerUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register MCP Server</span>
                  </button>
                </div>
              </div>

              {/* Registered Custom Servers List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Configured Servers ({settings.customMcpServers?.length || 0})
                </h4>

                {(!settings.customMcpServers || settings.customMcpServers.length === 0) && (
                  <div className="p-4 rounded-xl bg-zinc-900/20 border border-dashed border-zinc-800 text-center text-zinc-500 text-xs">
                    No custom external MCP servers added. The built-in sandbox server is active.
                  </div>
                )}

                {(settings.customMcpServers || []).map((srv) => (
                  <div
                    key={srv.id}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{srv.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                          {srv.type}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-zinc-500">{srv.url}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveCustomServer(srv.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Protocol Specs */}
          {activeTab === "docs" && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <Info className="w-4 h-4" />
                  <span>Model Context Protocol (MCP) in JOSIE</span>
                </div>
                <p>
                  Model Context Protocol is an open standard that allows LLMs to interact with secure data sources, code execution runtimes, and local tool suites.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-zinc-100">Tool Invocation Syntax:</h4>
                <p className="text-zinc-400">
                  When prompted, JOSIE outputs standard tool calling blocks:
                </p>
                <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-300 font-mono text-[11px]">
{`<mcp_call tool="execute_code">
{
  "code": "const primes = [2, 3, 5, 7, 11]; return primes.reduce((a, b) => a + b, 0);"
}
</mcp_call>`}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-zinc-100">Automatic Execution Lifecycle:</h4>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>System injects schema specifications of all enabled MCP tools into the model prompt.</li>
                  <li>During streaming inference, JOSIE formats the tool request tag.</li>
                  <li>The client UI detects the tool block and dispatches it to the isolated backend sandbox.</li>
                  <li>Execution outputs and console logs are rendered directly on the message card.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between text-xs">
          <div className="text-zinc-500 font-mono">
            Protocol: <span className="text-zinc-300">MCP 2024-11-05</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-all shadow-xs"
          >
            Save & Close
          </button>
        </div>
      </div>

      {/* Floating Tool Tester Drawer / Modal */}
      {testingTool && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-zinc-800">
                  {getToolIcon(testingTool.name)}
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 text-xs">
                    Live Test: {testingTool.displayName}
                  </h3>
                  <span className="font-mono text-[10px] text-zinc-400">{testingTool.name}</span>
                </div>
              </div>

              <button
                onClick={() => setTestingTool(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 flex-1 overflow-y-auto custom-scrollbar text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Parameters JSON Payload:
                </label>
                <textarea
                  value={testArgsInput}
                  onChange={(e) => setTestArgsInput(e.target.value)}
                  rows={6}
                  className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-hidden focus:border-emerald-500/50 resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunToolTest}
                  disabled={testRunning}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {testRunning ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{testRunning ? "Executing..." : "Execute MCP Function"}</span>
                </button>
              </div>

              {testResult && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-zinc-300">Execution Output:</span>
                    {testResult.success ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Success ({testResult.executionTimeMs}ms)
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 font-mono text-[10px]">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </div>

                  <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                    {testResult.error
                      ? testResult.error
                      : JSON.stringify(testResult.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
