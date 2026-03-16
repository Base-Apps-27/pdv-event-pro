/**
 * FeedbackSubmitForm — Modal form for submitting session feedback
 * 
 * 2026-03-16: Phase 1 of Feedback & Institutional Knowledge system.
 * Decision: "SessionFeedback entity — elevated users only, LiveView surface"
 * 
 * Context auto-detection: session/event/service are pre-filled from LiveView props.
 * Permission: access_live_view (enforced by parent — this component trusts its caller).
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DEPARTMENTS = [
  "Admin", "MC", "Sound", "Projection", "Hospitality", "Ujieres",
  "Kids", "Coordinador", "Stage & Decor", "Alabanza", "Translation", "Livestream", "Other"
];

const CATEGORIES = [
  "observation", "improvement", "issue_encountered", "what_went_well", "follow_up_needed"
];

export default function FeedbackSubmitForm({ open, onOpenChange, contextEventId, contextServiceId, contextSessionId, sessions = [] }) {
  const { t } = useLanguage();
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [sessionId, setSessionId] = useState(contextSessionId || "");
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackText.trim() || !category) return;
    setSubmitting(true);
    const payload = {
      feedback_text: feedbackText.trim(),
      category,
      follow_up_status: "pending",
    };
    if (department) payload.department = department;
    if (sessionId) payload.session_id = sessionId;
    if (contextEventId) payload.event_id = contextEventId;
    if (contextServiceId) payload.service_id = contextServiceId;

    await base44.entities.SessionFeedback.create(payload);
    toast.success(t('feedback.submitSuccess'));
    // Reset form
    setFeedbackText("");
    setCategory("");
    setDepartment("");
    setSessionId(contextSessionId || "");
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans normal-case">{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Session picker (if multiple sessions available) */}
          {sessions.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('feedback.session')}</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder={t('feedback.selectSession')} /></SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category (required) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('feedback.category')} *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder={t('feedback.selectCategory')} /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{t(`feedback.cat.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('feedback.department')}</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder={t('feedback.selectDepartment')} /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Free text (required) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('feedback.yourFeedback')} *</Label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t('feedback.textPlaceholder')}
              className="min-h-[120px] resize-y"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !feedbackText.trim() || !category}
              className="brand-gradient text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('feedback.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}