/**
 * ArtsReportView.jsx
 * 2026-03-09: Arts tab for the Reports page.
 * Uses already-loaded allSegments data (no extra fetches).
 * Filters to segments with art_types, groups by session.
 */
import React, { useMemo, useState } from 'react';
import { Palette, FileText, Loader2 } from 'lucide-react';
import ArtsReportSegmentCard from '@/components/arts/ArtsReportSegmentCard';
import { generateArtsReportPDF, downloadArtsPdf } from '@/components/arts/generateArtsReportPDF';

export default function ArtsReportView({ eventSessions, getSessionSegments, event, allSegments }) {
  const grouped = useMemo(() => {
    return eventSessions.map(session => ({
      session,
      artsSegments: getSessionSegments(session.id).filter(
        s => s.art_types && s.art_types.length > 0
      ),
    })).filter(g => g.artsSegments.length > 0);
  }, [eventSessions, getSessionSegments]);

  if (grouped.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-sm">No arts segments found for this event.</p>
        <p className="text-xs mt-1 text-gray-400">
          Segments with art types (dance, drama, video, etc.) will appear here once submitted.
        </p>
      </div>
    );
  }

  return (
    <div>
      {grouped.map(({ session, artsSegments }) => (
        <div key={session.id} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gray-200" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2 shrink-0">
              {session.name}
            </h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {artsSegments.map(seg => (
            <ArtsReportSegmentCard key={seg.id} seg={seg} sessionName={session.name} />
          ))}
        </div>
      ))}
    </div>
  );
}