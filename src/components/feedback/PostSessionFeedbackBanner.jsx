/**
 * PostSessionFeedbackBanner — Gentle nudge after a session ends
 * 
 * 2026-03-16: Appears when the last segment of the active session has passed its end_time.
 * Dismissible. Tapping "Share" opens the same FeedbackSubmitForm.
 * 
 * Permission: parent gates on access_live_view before rendering this component.
 */
import React, { useState, useMemo } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/utils/i18n.jsx";
import FeedbackSubmitForm from "./FeedbackSubmitForm";

export default function PostSessionFeedbackBanner({ segments, sessions, currentTime, serviceDate, contextEventId, contextServiceId }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Detect if all segments have ended (last segment end_time < currentTime)
  // 2026-03-21 FIX: Must compare against serviceDate, not today. Previously the
  // banner would show for tomorrow's services because segment end times (e.g. 10:05)
  // were compared to today's clock, making them appear "in the past" after that hour.
  const allSegmentsEnded = useMemo(() => {
    if (!segments || segments.length === 0) return false;
    const now = currentTime || new Date();

    // Guard: if serviceDate is in the future, session hasn't happened yet
    if (serviceDate) {
      const svcDate = new Date(serviceDate + 'T00:00:00');
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      if (svcDate > todayStart) return false;
    }

    const segmentsWithTime = segments.filter(s => s.end_time || s.actual_end_time);
    if (segmentsWithTime.length === 0) return false;

    return segmentsWithTime.every(s => {
      const endStr = s.actual_end_time || s.end_time;
      if (!endStr) return false;
      const [h, m] = endStr.split(':').map(Number);
      const endDate = new Date(now);
      endDate.setHours(h, m, 0, 0);
      return now > endDate;
    });
  }, [segments, currentTime, serviceDate]);

  if (dismissed || !allSegmentsEnded) return null;

  // Determine the most relevant session for context
  const activeSession = sessions?.length > 0 ? sessions[sessions.length - 1] : null;

  return (
    <>
      <div className="bg-gradient-to-r from-emerald-50 to-lime-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <MessageSquarePlus className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-sm text-emerald-800 font-medium">{t('feedback.bannerText')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            className="brand-gradient text-white text-xs"
          >
            {t('feedback.share')}
          </Button>
          <button onClick={() => setDismissed(true)} className="text-emerald-400 hover:text-emerald-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <FeedbackSubmitForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contextEventId={contextEventId}
        contextServiceId={contextServiceId}
        contextSessionId={activeSession?.id || ""}
        sessions={sessions}
      />
    </>
  );
}