/**
 * SundaySlotColumns — Responsive container for Sunday time-slot columns.
 *
 * Desktop (≥ 768px): Side-by-side with horizontal scroll (existing behavior).
 * Mobile  (< 768px): Tab-based switcher — one slot visible at a time.
 *
 * Blueprint Revamp (2026-02-18): Extracted from WeeklyServiceManager to keep
 * the orchestrator lean and enable mobile-aware slot display.
 */

import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ServiceTimeSlotColumn from "@/components/service/ServiceTimeSlotColumn";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
}

export default function SundaySlotColumns({
  sundaySlotNames,
  serviceData,
  expandedSegments,
  toggleSegmentExpanded,
  handlers,
  setServiceData,
  setSpecialSegmentDetails,
  setShowSpecialDialog,
  canEdit,
}) {
  const isMobile = useIsMobile();
  const [activeSlotTab, setActiveSlotTab] = useState(sundaySlotNames[0] || "");

  // Keep active tab in sync if slot names change
  useEffect(() => {
    if (sundaySlotNames.length > 0 && !sundaySlotNames.includes(activeSlotTab)) {
      setActiveSlotTab(sundaySlotNames[0]);
    }
  }, [sundaySlotNames, activeSlotTab]);

  const renderColumn = (slotName, slotIdx) => {
    const isFirst = slotIdx === 0;
    const isLast = slotIdx === sundaySlotNames.length - 1;
    return (
      <ServiceTimeSlotColumn
        key={slotName}
        timeSlot={slotName}
        style={isMobile ? {} : { minWidth: 480, flex: '1 0 480px' }}
        serviceData={serviceData}
        expandedSegments={expandedSegments}
        toggleSegmentExpanded={toggleSegmentExpanded}
        handleMoveSegment={handlers.handleMoveSegment}
        removeSpecialSegment={handlers.removeSpecialSegment}
        updateSegmentField={handlers.updateSegmentField}
        debouncedSave={handlers.debouncedSave}
        setServiceData={setServiceData}
        handleOpenVerseParser={handlers.handleOpenVerseParser}
        calculateServiceTimes={handlers.calculateServiceTimes}
        copySegmentToNextSlot={isFirst && sundaySlotNames.length > 1 ? handlers.copySegmentToNextSlot : null}
        copyPreServiceNotesToNextSlot={isFirst && sundaySlotNames.length > 1 ? handlers.copyPreServiceNotesToNextSlot : null}
        copyTeamToNextSlot={isFirst && sundaySlotNames.length > 1 ? handlers.copyTeamToNextSlot : null}
        copyAllToNextSlot={!isFirst ? handlers.copyAllToNextSlot : null}
        nextSlotName={isFirst && sundaySlotNames.length > 1 ? sundaySlotNames[1] : null}
        isLastSlot={isLast}
        onOpenSpecialDialog={(ts) => {
          setSpecialSegmentDetails(prev => ({ ...prev, timeSlot: ts }));
          setShowSpecialDialog(true);
        }}
        canEdit={canEdit}
      />
    );
  };

  // Single slot — no tabs needed
  if (sundaySlotNames.length <= 1) {
    return (
      <div className="overflow-x-auto -mx-2 px-2">
        {sundaySlotNames.map((name, idx) => renderColumn(name, idx))}
      </div>
    );
  }

  // Mobile: tab switcher
  if (isMobile) {
    return (
      <Tabs value={activeSlotTab} onValueChange={setActiveSlotTab}>
        <style>{`
          [data-slot-tab][data-state="active"] { background-color: #1F8A70 !important; color: #ffffff !important; }
          [data-slot-tab][data-state="active"] .badge-slot-dur { color: rgba(255,255,255,0.8) !important; border-color: rgba(255,255,255,0.4) !important; }
        `}</style>
        <TabsList className="w-full h-11 bg-gray-200 mb-3">
          {sundaySlotNames.map((name, idx) => {
            const segments = serviceData[name] || [];
            const totalMin = segments.reduce((sum, s) => sum + (s.duration || 0), 0);
            return (
              <TabsTrigger
                key={name}
                value={name}
                className="flex-1 px-2 py-1.5 text-sm font-bold text-gray-700"
                data-slot-tab="true"
              >
                {name.replace('am', ' AM').replace('pm', ' PM')}
                <Badge variant="outline" className="ml-1 text-[9px] text-gray-600 border-gray-400 badge-slot-dur">{totalMin}m</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {sundaySlotNames.map((name, idx) => (
          <TabsContent key={name} value={name} className="mt-0">
            {renderColumn(name, idx)}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  // Desktop: horizontal scroll
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="flex gap-6" style={{ minWidth: `${sundaySlotNames.length * 520}px` }}>
        {sundaySlotNames.map((name, idx) => renderColumn(name, idx))}
      </div>
    </div>
  );
}