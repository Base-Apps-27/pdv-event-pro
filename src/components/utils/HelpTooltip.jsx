/**
 * HelpTooltip.jsx
 * Reusable contextual help component. Supports two modes:
 *   - inline tooltip (default): small (?) icon with hover tooltip
 *   - modal: small (?) icon that opens a dialog with longer content
 *
 * Props:
 *   helpKey  — key into HELP_CONTENT dictionary
 *   mode     — 'tooltip' (default) | 'modal'
 *   side     — tooltip placement: 'top' | 'bottom' | 'left' | 'right'
 *   className — extra classes on the wrapper
 */
import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/components/utils/i18n";
import { HELP_CONTENT } from "@/components/utils/helpContent";

export default function HelpTooltip({ helpKey, mode = "tooltip", side = "top", className = "" }) {
  const { language } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);

  const entry = HELP_CONTENT[helpKey];
  if (!entry) return null;

  const lang = language === 'en' ? 'en' : 'es';
  const title = entry.title?.[lang] || entry.title?.es || "";
  const body = entry.body?.[lang] || entry.body?.es || "";

  if (mode === "modal") {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center justify-center rounded-full text-slate-400 hover:text-pdv-teal hover:bg-slate-100 transition-colors p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pdv-teal ${className}`}
          aria-label={title}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">{title}</DialogTitle>
            </DialogHeader>
            <DialogDescription asChild>
              <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{body}</div>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default: inline tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full text-slate-400 hover:text-pdv-teal hover:bg-slate-100 transition-colors p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pdv-teal ${className}`}
          aria-label={title}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {title && <p className="font-bold mb-1">{title}</p>}
        <p className="whitespace-pre-line">{body}</p>
      </TooltipContent>
    </Tooltip>
  );
}