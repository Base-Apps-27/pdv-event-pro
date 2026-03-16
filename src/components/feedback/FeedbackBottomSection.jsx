/**
 * FeedbackBottomSection — Static in-flow feedback call-to-action
 * 
 * 2026-03-16: Replaces the floating FAB which overlapped with StickyOpsDeck.
 * Decision: "Move feedback CTA to bottom of page (in-flow) instead of FAB"
 * 
 * Positioned above the footer in PublicProgramView. Users scroll to the bottom
 * of the program to find it — always accessible, never overlapping with
 * operational UI (StickyOpsDeck, chat, etc.).
 * 
 * Permission: parent gates on access_live_view before rendering.
 */
import React, { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/utils/i18n.jsx";
import FeedbackSubmitForm from "./FeedbackSubmitForm";

export default function FeedbackBottomSection({ contextEventId, contextServiceId, contextSessionId, sessions }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <MessageSquarePlus className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">{t('feedback.bottomTitle')}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{t('feedback.bottomSubtitle')}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="brand-gradient text-white flex-shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4 mr-1.5" />
            {t('feedback.share')}
          </Button>
        </div>
      </div>

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