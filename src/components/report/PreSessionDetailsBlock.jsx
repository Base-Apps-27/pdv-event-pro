/**
 * Pre-Session Details Block — Shared by all report views
 * 
 * Extracted from pages/Reports.jsx (Phase 3D)
 * Eliminates the duplicated IIFE pattern across 6 report views.
 */
import React from "react";
import { Music, Sliders } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { mergePreSessionDetails } from "./reportHelpers";

export default function PreSessionDetailsBlock({ sessionId, allPreSessionDetails }) {
  const records = allPreSessionDetails.filter(psd => psd.session_id === sessionId);
  if (records.length === 0) return null;
  const psd = mergePreSessionDetails(records);
  if (!psd) return null;

  return (
    <div className="mt-2 bg-blue-50 border border-blue-200 p-2 rounded text-[10px]">
      <div className="font-bold text-blue-700 uppercase mb-1">Detalles Previos (Segmento 0)</div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
        {psd.music_profile_id && (
          <div><Music className="inline-block w-3 h-3 mr-1 text-blue-600" /> Música: {psd.music_profile_id}</div>
        )}
        {psd.slide_pack_id && (
          <div><Sliders className="inline-block w-3 h-3 mr-1 text-blue-600" /> Slides: {psd.slide_pack_id}</div>
        )}
        {psd.registration_desk_open_time && (
          <div><span className="font-semibold">Registro:</span> {formatTimeToEST(psd.registration_desk_open_time)}</div>
        )}
        {psd.library_open_time && (
          <div><span className="font-semibold">Librería:</span> {formatTimeToEST(psd.library_open_time)}</div>
        )}
        {psd.facility_notes && (
          <div className="col-span-2"><span className="font-semibold">Instalaciones:</span> {psd.facility_notes}</div>
        )}
        {psd.general_notes && (
          <div className="col-span-2"><span className="font-semibold">General:</span> {psd.general_notes}</div>
        )}
      </div>
    </div>
  );
}