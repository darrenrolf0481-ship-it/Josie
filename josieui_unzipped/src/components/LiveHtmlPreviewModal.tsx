import React from "react";
import { X, Eye, Code, ExternalLink } from "lucide-react";

interface LiveHtmlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

export const LiveHtmlPreviewModal: React.FC<LiveHtmlPreviewModalProps> = ({
  isOpen,
  onClose,
  code,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-semibold text-zinc-100">
              Live Sandboxed Preview
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content iframe */}
        <div className="flex-1 bg-white relative">
          <iframe
            title="Generated Preview"
            srcDoc={code}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-850 bg-zinc-900/80 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-[11px]">Rendered securely in sandboxed iframe</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
