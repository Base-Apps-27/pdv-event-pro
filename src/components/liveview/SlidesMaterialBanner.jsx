/**
 * SlidesMaterialBanner — 2026-03-22
 *
 * PROMINENT banner displayed at the top of Live View when ANY segment in the
 * current program has presentation slides or speaker notes (presentation_url,
 * notes_url, or content_is_slides_only).
 *
 * Design rationale (from product owner):
 *   - Slides are RARE — when they exist the team MUST notice.
 *   - Must be the HIGHEST priority visual element on the page.
 *   - Uses a distinct color (indigo/purple gradient) so it doesn't compete
 *     with the amber time-adjustment banner or the green feedback banner.
 *   - Renders per-session breakdown so teams serving both slots see all info.
 *
 * Surfaces: PublicProgramView (Live View)
 * Entities read: none (receives segments + sessions as props)
 */

import React, { useMemo } from "react";
import { Presentation, FileText, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n.jsx";

/**
 * Detect segments that carry slides/presentation material.
 * Returns an array of { segment, sessionName } objects.
 */
function findSlidesSegments(allSegments, sessions) {
  const sessionMap = new Map();
  (sessions || []).forEach(s => sessionMap.set(s.id, s.name || "Session"));

  return (allSegments || []).filter(seg => {
    const hasPresentation = seg.presentation_url &&
      (Array.isArray(seg.presentation_url) ? seg.presentation_url.length > 0 : !!seg.presentation_url);
    const hasNotes = seg.notes_url &&
      (Array.isArray(seg.notes_url) ? seg.notes_url.length > 0 : !!seg.notes_url);
    const isSlidesOnly = seg.content_is_slides_only === true;
    return hasPresentation || hasNotes || isSlidesOnly;
  }).map(seg => ({
    segment: seg,
    sessionName: sessionMap.get(seg.session_id) || "",
  }));
}

export default function SlidesMaterialBanner({ allSegments, sessions }) {
  const { t } = useLanguage();

  const slidesItems = useMemo(
    () => findSlidesSegments(allSegments, sessions),
    [allSegments, sessions]
  );

  if (slidesItems.length === 0) return null;

  // Group by session for display
  const bySession = {};
  slidesItems.forEach(({ segment, sessionName }) => {
    const key = sessionName || "—";
    if (!bySession[key]) bySession[key] = [];
    bySession[key].push(segment);
  });

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-xl px-4 py-3 shadow-lg border border-indigo-400/30 animate-in fade-in slide-in-from-top-2">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Presentation className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm uppercase tracking-wide">
            {t('slides.bannerTitle')}
          </p>
          <p className="text-indigo-200 text-xs">
            {t('slides.bannerSubtitle')}
          </p>
        </div>
        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
          {slidesItems.length}
        </span>
      </div>

      {/* Per-session breakdown */}
      <div className="space-y-1.5">
        {Object.entries(bySession).map(([sessionName, segments]) => (
          <div key={sessionName} className="bg-white/10 rounded-lg px-3 py-2">
            {sessionName !== "—" && (
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                {sessionName.replace("am", " AM").replace("pm", " PM")}
              </p>
            )}
            {segments.map((seg, idx) => (
              <div key={seg.id || idx} className="flex items-center gap-2 text-white text-xs">
                <span className="font-semibold truncate max-w-[180px]">
                  {seg.title || t('segment.untitled')}
                </span>
                {seg.presenter && (
                  <span className="text-indigo-200 truncate max-w-[100px]">
                    — {seg.presenter}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  {seg.presentation_url && (Array.isArray(seg.presentation_url) ? seg.presentation_url.length > 0 : !!seg.presentation_url) && (
                    <a
                      href={Array.isArray(seg.presentation_url) ? seg.presentation_url[0] : seg.presentation_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-0.5 bg-white/20 hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
                      title={t('slides.openSlides')}
                    >
                      <Presentation className="w-3 h-3" />
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {seg.notes_url && (Array.isArray(seg.notes_url) ? seg.notes_url.length > 0 : !!seg.notes_url) && (
                    <a
                      href={Array.isArray(seg.notes_url) ? seg.notes_url[0] : seg.notes_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-0.5 bg-white/20 hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
                      title={t('slides.openNotes')}
                    >
                      <FileText className="w-3 h-3" />
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {seg.content_is_slides_only && (
                    <span className="bg-yellow-400/30 text-yellow-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {t('slides.slidesOnly')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export the detection helper for use in PDF/other surfaces
export { findSlidesSegments };