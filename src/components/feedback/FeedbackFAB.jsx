/**
 * FeedbackFAB — Floating Action Button for quick feedback access
 * 
 * 2026-03-16: Non-intrusive persistent icon on PublicProgramView.
 * Renders a small notepad icon in the bottom-right corner (above mobile nav).
 * Tapping opens FeedbackSubmitForm as a modal sheet.
 * 
 * Permission: parent gates on access_live_view before rendering this component.
 */
import React, { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/components/utils/i18n.jsx";
import FeedbackSubmitForm from "./FeedbackSubmitForm";

export default function FeedbackFAB({ contextEventId, contextServiceId, contextSessionId, sessions }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      {/* FAB button — positioned above StickyOpsDeck's bar/expanded view on mobile.
           StickyOpsDeck bar uses bottom-[5.5rem] + ~80px height = ~170px from bottom.
           FAB sits at bottom-[11rem] (176px) on mobile to clear it.
           On lg+ screens, bottom tab bar is gone so bottom-6 suffices. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-[11rem] lg:bottom-6 right-4 z-30 w-12 h-12 rounded-full brand-gradient text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center active:scale-95"
            aria-label={t('feedback.fabLabel')}
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t('feedback.fabLabel')}</p>
        </TooltipContent>
      </Tooltip>

      <FeedbackSubmitForm
        open={open}
        onOpenChange={setOpen}
        contextEventId={contextEventId}
        contextServiceId={contextServiceId}
        contextSessionId={contextSessionId}
        sessions={sessions}
      />
    </>
  );
}