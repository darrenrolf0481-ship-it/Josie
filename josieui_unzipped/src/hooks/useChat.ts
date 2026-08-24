import { useState, useRef, useCallback } from "react";
import { AppSettings, ChatMessage, McpToolCall } from "../types";
import {
  streamChatCompletion,
  executeMcpToolApi,
  TextToSpeechManager,
  StreamCallback,
} from "../lib/api";

interface UseChatParams {
  settings: AppSettings;
  activePersonaId: string;
  activePersonaSystemPrompt: string;
  updateConversationMessages: (
    convId: string,
    updater: (messages: ChatMessage[]) => ChatMessage[]
  ) => void;
  updateConversation: (convId: string, patch: Record<string, unknown>) => void;
  addConversation: (conv: import("../types").Conversation) => void;
  getActiveConversation: () => import("../types").Conversation | null;
}

export function useChat({
  settings,
  activePersonaId,
  activePersonaSystemPrompt,
  updateConversationMessages,
  updateConversation,
  addConversation,
  getActiveConversation,
}: UseChatParams) {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<
    string | null
  >(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateToolCall = useCallback(
    (msgId: string, updatedCall: McpToolCall, convId: string) => {
      updateConversationMessages(convId, (messages) =>
        messages.map((m) => {
          if (m.id !== msgId) return m;
          const calls = (m.mcpToolCalls || []).map((call) =>
            call.id === updatedCall.id ? updatedCall : call
          );
          return { ...m, mcpToolCalls: calls };
        })
      );
    },
    [updateConversationMessages]
  );

  const sendMessage = useCallback(
    async (userPromptText?: string) => {
      const promptToSend = (
        userPromptText !== undefined ? userPromptText : input
      ).trim();
      if (!promptToSend || isGenerating) return;

      let targetConv = getActiveConversation();
      if (!targetConv) {
        const newId = `conv-${Date.now()}`;
        targetConv = {
          id: newId,
          title: promptToSend.slice(0, 30),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          provider: settings.provider,
          model:
            settings.provider === "ollama"
              ? settings.ollamaModel
              : settings.openRouterModel,
          personaId: activePersonaId,
          systemPrompt: activePersonaSystemPrompt,
        };
        addConversation(targetConv);
      }

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: promptToSend,
        timestamp: Date.now(),
      };

      const assistantMessageId = `msg-${Date.now()}-asst`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thought: "",
        timestamp: Date.now(),
        model:
          settings.provider === "ollama"
            ? settings.ollamaModel
            : settings.openRouterModel,
        provider: settings.provider,
        isStreaming: true,
        searchGrounded: settings.webSearchEnabled,
        searchQuery: settings.webSearchEnabled ? promptToSend : undefined,
        groundingSources: [],
      };

      const shouldUpdateTitle = targetConv.messages.length === 0;
      const newTitle = shouldUpdateTitle
        ? promptToSend.slice(0, 36) + (promptToSend.length > 36 ? "..." : "")
        : targetConv.title;

      const updatedMessages = [
        ...targetConv.messages,
        userMessage,
        assistantMessage,
      ];

      updateConversationMessages(targetConv.id, () => updatedMessages);

      if (shouldUpdateTitle && targetConv.id) {
        updateConversation(targetConv.id, { title: newTitle });
      }

      setInput("");
      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const messagesPayload = updatedMessages
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));
      let pendingToolCalls: McpToolCall[] = [];
      let toolRound = 0;
      const executedToolCallIds = new Set<string>();

      const callbacks: StreamCallback = {
        onMcpToolDetected: (detectedTools) => {
          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) => {
              if (m.id !== assistantMessageId) return m;
              const existingCalls = m.mcpToolCalls || [];
              const mergedCalls = [...existingCalls];
              detectedTools.forEach((newCall) => {
                if (!mergedCalls.some((call) => call.id === newCall.id)) {
                  mergedCalls.push(newCall);
                }
                if (!pendingToolCalls.some((call) => call.id === newCall.id)) {
                  pendingToolCalls.push(newCall);
                }
              });
              return { ...m, mcpToolCalls: mergedCalls };
            })
          );
        },
        onGrounding: (groundingData) => {
          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    searchGrounded: true,
                    searchQuery: groundingData.searchQuery || promptToSend,
                    groundingSources: groundingData.sources || [],
                  }
                : m
            )
          );
        },
        onChunk: (_chunk, content, thought) => {
          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content, thought, isStreaming: true }
                : m
            )
          );
        },
        onMetrics: (metrics) => {
          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) => (m.id === assistantMessageId ? { ...m, metrics } : m))
          );
        },
        onComplete: async (content, thought, metrics) => {
          const callsToExecute = pendingToolCalls;
          pendingToolCalls = [];

          if (settings.mcpAutoExecute && callsToExecute.length > 0 && toolRound < 2) {
            toolRound += 1;
            updateConversationMessages(targetConv!.id, (msgs) =>
              msgs.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content, thought, metrics, isStreaming: true }
                  : m
              )
            );

            const toolResults = await Promise.all(
              callsToExecute
                .filter((toolCall) => !executedToolCallIds.has(toolCall.id))
                .map(async (toolCall) => {
                executedToolCallIds.add(toolCall.id);
                updateToolCall(
                  assistantMessageId,
                  { ...toolCall, status: "running" },
                  targetConv!.id
                );
                const result = await executeMcpToolApi(toolCall.toolName, toolCall.args);
                const completedCall: McpToolCall = {
                  ...toolCall,
                  status: result.success ? "success" : "error",
                  result: result.result,
                  error: result.error,
                  executionTimeMs: result.executionTimeMs,
                };
                updateToolCall(assistantMessageId, completedCall, targetConv!.id);
                return completedCall;
              })
            );

            const resultMessage = toolResults
              .map(
                (call) =>
                  `[MCP RESULT: ${call.toolName}]\n${JSON.stringify(
                    call.status === "success" ? call.result : { error: call.error },
                    null,
                    2
                  )}`
              )
              .join("\n\n");

            await streamChatCompletion({
              messages: [
                ...messagesPayload,
                { role: "assistant", content },
                { role: "user", content: resultMessage },
              ],
              settings,
              systemPrompt: activePersonaSystemPrompt,
              signal: controller.signal,
              callbacks,
            });
            return;
          }

          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content, thought, metrics, isStreaming: false }
                : m
            )
          );
          setIsGenerating(false);
          abortControllerRef.current = null;

          if (settings.autoSpeak && content) {
            TextToSpeechManager.speak(content, {
              voiceName: settings.speechVoice,
              pitch: settings.speechPitch,
              rate: settings.speechRate,
              onStart: () => setCurrentlySpeakingText(content),
              onEnd: () => setCurrentlySpeakingText(null),
            });
          }
        },
        onError: (err) => {
          console.error("Chat completion stream error:", err);
          updateConversationMessages(targetConv!.id, (msgs) =>
            msgs.map((m) =>
              m.id === assistantMessageId
                ? { ...m, isStreaming: false, error: err.message }
                : m
            )
          );
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
      };

      try {
        await streamChatCompletion({
          messages: messagesPayload,
          settings,
          systemPrompt: activePersonaSystemPrompt,
          signal: controller.signal,
          callbacks,
        });
      } catch (err: any) {
        console.error("Stream initialization error:", err);
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isGenerating,
      settings,
      activePersonaId,
      activePersonaSystemPrompt,
      updateConversationMessages,
      updateConversation,
      addConversation,
      getActiveConversation,
      updateToolCall,
    ]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      TextToSpeechManager.speak(text, {
        voiceName: settings.speechVoice,
        pitch: settings.speechPitch,
        rate: settings.speechRate,
        onStart: () => setCurrentlySpeakingText(text),
        onEnd: () => setCurrentlySpeakingText(null),
      });
    },
    [settings.speechVoice, settings.speechPitch, settings.speechRate]
  );

  const stopSpeaking = useCallback(() => {
    TextToSpeechManager.stop();
    setCurrentlySpeakingText(null);
  }, []);

  const handleRegenerateLast = useCallback(() => {
    const targetConv = getActiveConversation();
    if (
      !targetConv ||
      targetConv.messages.length === 0 ||
      isGenerating
    )
      return;

    const messages = targetConv.messages;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const lastUserContent = messages[lastUserIdx].content;
    const trimmed = messages.slice(0, lastUserIdx);

    updateConversationMessages(targetConv.id, () => trimmed);
    setTimeout(() => sendMessage(lastUserContent), 0);
  }, [getActiveConversation, isGenerating, updateConversationMessages, sendMessage]);

  const forkConversation = useCallback(
    (fromMessageId: string) => {
      const targetConv = getActiveConversation();
      if (!targetConv) return;

      const idx = targetConv.messages.findIndex(
        (m) => m.id === fromMessageId
      );
      if (idx === -1) return;

      const branchedMessages = targetConv.messages.slice(0, idx + 1);
      const newConv = {
        ...targetConv,
        id: `conv-${Date.now()}`,
        title: `Branch: ${targetConv.title.slice(0, 24)}`,
        messages: branchedMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addConversation(newConv);
    },
    [getActiveConversation, addConversation]
  );

  const editUserMessage = useCallback(
    (msgId: string, newContent: string) => {
      const targetConv = getActiveConversation();
      if (!targetConv) return;

      const idx = targetConv.messages.findIndex((m) => m.id === msgId);
      if (idx === -1) return;

      const trimmed = targetConv.messages.slice(0, idx);
      updateConversationMessages(targetConv.id, () => trimmed);

      setTimeout(() => sendMessage(newContent), 0);
    },
    [getActiveConversation, updateConversationMessages, sendMessage]
  );

  const toggleBookmark = useCallback(
    (msgId: string) => {
      const targetConv = getActiveConversation();
      if (!targetConv) return;

      updateConversationMessages(targetConv.id, (msgs) =>
        msgs.map((m) =>
          m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m
        )
      );
    },
    [getActiveConversation, updateConversationMessages]
  );

  return {
    input,
    setInput,
    isGenerating,
    currentlySpeakingText,
    sendMessage,
    stopGeneration,
    speak,
    stopSpeaking,
    handleRegenerateLast,
    forkConversation,
    editUserMessage,
    toggleBookmark,
    updateToolCall,
  };
}