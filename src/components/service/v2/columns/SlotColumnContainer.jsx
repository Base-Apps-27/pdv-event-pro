/**
 * SlotColumnContainer.jsx — V2 responsive container for slot columns.
 * HARDENING (Phase 9):
 *   - Memoized with React.memo
 *   - Print layout: stacked with page breaks
 *   - Keyboard-accessible tab navigation
 *   - Dirty indicator on mobile tabs (red dot)
 */

import React, { useState, useEffect, useMemo, memo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import SlotColumn from "./SlotColumn";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default memo(function SlotColumnContainer({ sessions, segmentsBySession, childSegments, psdBySession, columnProps }) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(sessions[0]?.name || '');

  useEffect(() => {
    if (sessions.length > 0 && !sessions.find(s => s.name === activeTab)) {
      setActiveTab(sessions[0].name);
    }
  }, [sessions, activeTab]);

  // Check which sessions have dirty segments (for tab indicator)
  const dirtySessionIds = useMemo(() => {
    if (!columnProps.dirtyIds?.size) return new Set();
    const result = new Set();
    for (const session of sessions) {
      const segs = segmentsBySession[session.id] || [];
      for (const seg of segs) {
        if (columnProps.dirtyIds.has(String(seg.id))) {
          result.add(session.id);
          break;
        }
      }
    }
    return result;
  }, [sessions, segmentsBySession, columnProps.dirtyIds]);

  const renderColumn = (session, idx) => {
    const isLast = idx === sessions.length - 1;
    const nextSession = !isLast ? sessions[idx + 1] : null;
    const prevSession = idx > 0 ? sessions[idx - 1] : null;

    return (
      <SlotColumn
        key={session.id}
        session={session}
        segments={segmentsBySession[session.id] || []}
        childSegments={childSegments}
        psd={psdBySession[session.id]}
        slotIndex={idx}
        isLastSlot={isLast}
        nextSlotName={nextSession?.name}
        style={isMobile ? {} : { minWidth: 480, flex: '1 0 480px' }}
        {...columnProps}
        onOpenVerseParser={columnProps.onOpenVerseParser}
        onCopyToNext={nextSession ? columnProps.onCopyToNext : null}
        onCopyAllToSlot={prevSession ? () => columnProps.onCopyAllToSlot?.(prevSession.id, session.id) : null}
      />
    );
  };

  // Single slot — no tabs needed
  if (sessions.length <= 1) {
    return (
      <div className="overflow-x-auto -mx-2 px-2">
        {sessions.map((s, idx) => renderColumn(s, idx))}
      </div>
    );
  }

  // Mobile: tabs
  if (isMobile) {
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <style>{`[data-v2-slot-tab][data-state="active"] { background-color: #1F8A70 !important; color: #ffffff !important; }`}</style>
        <TabsList className="w-full h-11 bg-gray-200 mb-3 print:hidden">
          {sessions.map((s, idx) => {
            const segs = segmentsBySession[s.id] || [];
            const totalMin = segs.reduce((sum, seg) => sum + (seg.duration_min || 0), 0);
            const isDirty = dirtySessionIds.has(s.id);
            return (
              <TabsTrigger key={s.id} value={s.name} className="flex-1 px-2 py-1.5 text-sm font-bold text-gray-700 relative" data-v2-slot-tab="true">
                {s.name?.replace('am', ' AM').replace('pm', ' PM')}
                <Badge variant="outline" className="ml-1 text-[9px] text-gray-600 border-gray-400">{totalMin}m</Badge>
                {isDirty && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {sessions.map((s, idx) => (
          <TabsContent key={s.id} value={s.name} className="mt-0">
            {renderColumn(s, idx)}
          </TabsContent>
        ))}
        {/* Print: show all columns stacked */}
        <div className="hidden print:block space-y-8">
          {sessions.map((s, idx) => renderColumn(s, idx))}
        </div>
      </Tabs>
    );
  }

  // Desktop: horizontal scroll
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="flex gap-6" style={{ minWidth: `${sessions.length * 520}px` }}>
        {sessions.map((s, idx) => renderColumn(s, idx))}
      </div>
    </div>
  );
});