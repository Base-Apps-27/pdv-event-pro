/**
 * Ushers Report View — Time/title/ushers notes table
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-3e)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 */
import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import PreSessionDetailsBlock from "./PreSessionDetailsBlock";

export default function UshersReportView({ eventSessions, getSessionSegments, allPreSessionDetails }) {
  return (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_ushers');
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className="print-session">
            <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg mb-4 border border-green-200">
              <h3 className="text-xl text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <PreSessionDetailsBlock sessionId={session.id} allPreSessionDetails={allPreSessionDetails} />

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-50 border-b-2 border-green-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Ujieres</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.ushers_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {segment.ushers_notes || <span className="italic text-gray-400">Sin notas específicas</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}