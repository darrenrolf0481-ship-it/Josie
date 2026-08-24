import { useState, useCallback } from "react";

export function useModals() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOllamaGuideOpen, setIsOllamaGuideOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isMcpHubOpen, setIsMcpHubOpen] = useState(false);
  const [previewHtmlCode, setPreviewHtmlCode] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const openOllamaGuide = useCallback(() => setIsOllamaGuideOpen(true), []);
  const closeOllamaGuide = useCallback(() => setIsOllamaGuideOpen(false), []);

  const openPersonaSelector = useCallback(
    () => setIsPersonaSelectorOpen(true),
    []
  );
  const closePersonaSelector = useCallback(
    () => setIsPersonaSelectorOpen(false),
    []
  );

  const openPromptLibrary = useCallback(
    () => setIsPromptLibraryOpen(true),
    []
  );
  const closePromptLibrary = useCallback(
    () => setIsPromptLibraryOpen(false),
    []
  );

  const openMcpHub = useCallback(() => setIsMcpHubOpen(true), []);
  const closeMcpHub = useCallback(() => setIsMcpHubOpen(false), []);

  const openPreview = useCallback(
    (htmlCode: string) => setPreviewHtmlCode(htmlCode),
    []
  );
  const closePreview = useCallback(() => setPreviewHtmlCode(null), []);

  return {
    isSidebarOpen,
    isSettingsOpen,
    isOllamaGuideOpen,
    isPersonaSelectorOpen,
    isPromptLibraryOpen,
    isMcpHubOpen,
    previewHtmlCode,
    toggleSidebar,
    closeSidebar,
    openSettings,
    closeSettings,
    openOllamaGuide,
    closeOllamaGuide,
    openPersonaSelector,
    closePersonaSelector,
    openPromptLibrary,
    closePromptLibrary,
    openMcpHub,
    closeMcpHub,
    openPreview,
    closePreview,
  };
}