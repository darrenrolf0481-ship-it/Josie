import { useState, useEffect, useCallback, useRef } from "react";
import { ChatMessage, Conversation } from "../types";
import {
  getStoredConversations,
  saveStoredConversations,
  getActiveConversationId,
  setActiveConversationId,
} from "../lib/storage";

export function useConversations(settings: {
  provider: string;
  ollamaModel: string;
  openRouterModel: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(
    getStoredConversations
  );
  const [activeConvId, setActiveConvId] = useState<string | null>(
    getActiveConversationId
  );
  const initializedRef = useRef(false);

  // Persist conversations to localStorage on change
  useEffect(() => {
    saveStoredConversations(conversations);
  }, [conversations]);

  // Persist active conversation id
  useEffect(() => {
    setActiveConversationId(activeConvId);
  }, [activeConvId]);

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) ?? null;

  const createNewChat = useCallback(
    (personaId?: string, systemPrompt?: string) => {
      const newId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        title: "New Conversation",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: settings.provider as any,
        model:
          settings.provider === "ollama"
            ? settings.ollamaModel
            : settings.openRouterModel,
        personaId,
        systemPrompt,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newId);
      return newConv;
    },
    [settings.provider, settings.ollamaModel, settings.openRouterModel]
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (activeConvId === id) {
          setActiveConvId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
    },
    [activeConvId]
  );

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
      )
    );
  }, []);

  const togglePin = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const clearAllConversations = useCallback(() => {
    setConversations([]);
    setActiveConvId(null);
  }, []);

  const resetConversations = useCallback(
    (personaId?: string, systemPrompt?: string) => {
      const now = Date.now();
      const newConv: Conversation = {
        id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: "New Conversation",
        messages: [],
        createdAt: now,
        updatedAt: now,
        provider: settings.provider as any,
        model: settings.provider === "ollama" ? settings.ollamaModel : settings.openRouterModel,
        personaId,
        systemPrompt,
      };
      setConversations([newConv]);
      setActiveConvId(newConv.id);
      return newConv;
    },
    [settings.provider, settings.ollamaModel, settings.openRouterModel]
  );

  const updateConversationMessages = useCallback(
    (
      convId: string,
      updater: (messages: ChatMessage[]) => ChatMessage[]
    ) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: updater(c.messages), updatedAt: Date.now() }
            : c
        )
      );
    },
    []
  );

  const updateConversation = useCallback(
    (convId: string, patch: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, ...patch, updatedAt: Date.now() } : c
        )
      );
    },
    []
  );

  const addConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
  }, []);

  const overwriteConversations = useCallback(
    (newConversations: Conversation[]) => {
      setConversations(newConversations);
      setActiveConvId(newConversations[0]?.id ?? null);
    },
    []
  );

  // Initialize: create a conversation if none exist
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (conversations.length === 0) {
      createNewChat();
    } else if (!activeConvId || !conversations.some((conversation) => conversation.id === activeConvId)) {
      setActiveConvId(conversations[0].id);
    }
  }, [activeConvId, conversations, createNewChat]);

  return {
    conversations,
    activeConvId,
    activeConversation,
    createNewChat,
    resetConversations,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePin,
    clearAllConversations,
    updateConversationMessages,
    updateConversation,
    addConversation,
    overwriteConversations,
  };
}