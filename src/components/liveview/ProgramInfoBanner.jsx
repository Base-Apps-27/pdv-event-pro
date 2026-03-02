/**
 * ProgramInfoBanner — P3 DEV-1 (2026-03-02)
 * 
 * Displays event/service name, date, location, and theme below selectors.
 * Extracted from PublicProgramView.
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDateET } from "@/components/utils/timeFormat";

export default function ProgramInfoBanner({ viewType, selectedEvent, selectedService, isOverride }) {
  const date = viewType === "event" ? selectedEvent?.start_date : selectedService?.date;
  const name = viewType === "event" ? selectedEvent?.name : selectedService?.name;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 text-xs uppercase font-bold tracking-wider">
        <Calendar className="w-3 h-3" />
        <span>{date ? formatDateET(date) : ""}</span>
        {viewType === "event" && selectedEvent?.location && (
          <>
            <span>•</span>
            <span className="truncate">{selectedEvent.location}</span>
          </>
        )}
        {isOverride && (
          <>
            <span>•</span>
            <span className="text-orange-500 font-bold">🧪 TEST OVERRIDE</span>
          </>
        )}
      </div>
      <h2 className="text-2xl text-gray-900 leading-tight">{name}</h2>
      {viewType === "event" && selectedEvent?.theme && (
        <p className="text-pdv-teal font-medium italic">"{selectedEvent.theme}"</p>
      )}
    </div>
  );
}