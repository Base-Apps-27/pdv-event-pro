/**
 * Projection Report View — Time/title/projection notes table
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-3b)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 */
import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import PreSessionDetailsBlock from "./PreSessionDetailsBlock";
// 2026-02-28: Smart routing surfaces arts data relevant to projection (video, cues, scripts)
import { getArtsSmartNotes } from "@/components/utils/artsSmartRouting";

export default function ProjectionReportView({ eventSessions, getSessionSegments, allPreSessionDetails }) {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_projection');
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className="print-session">
            {/* Projection report header - slate color scheme (distinct from purple/translation) */}
            <div className="bg-gradient-to-r from-slate-100 to-gray-100 p-4 rounded-lg mb-4 border border-slate-300">
              <h3 className="text-xl text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <PreSessionDetailsBlock sessionId={session.id} allPreSessionDetails={allPreSessionDetails} />

            <table className="w-full border-collapse">
              <thead>
                {/* Projection table header - slate color scheme */}
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Proyección</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.projection_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-sm text-gray-700">
                      <div className="space-y-1">
                        {segment.has_video && (
                          <div className="bg-blue-50 px-1 py-0.5 rounded border border-blue-200 text-[10px]">
                            <span className="font-bold text-blue-700">VIDEO:</span>
                            {segment.video_name && <span className="ml-1 text-gray-700">{segment.video_name}</span>}
                            {segment.video_location && <span className="ml-1 text-gray-600">({segment.video_location})</span>}
                            {typeof segment.video_length_sec === 'number' && (
                              <span className="ml-1 text-gray-600">- {Math.floor(segment.video_length_sec / 60)}:{String(segment.video_length_sec % 60).padStart(2, '0')}</span>
                            )}
                            {segment.video_owner && <span className="ml-1 text-gray-600">• {segment.video_owner}</span>}
                          </div>
                        )}

                        {/* 2026-02-28: Replaced hardcoded arts rendering with smart routing.
                         * getArtsSmartNotes('projection') returns only projection-relevant items:
                         * video info, cues, scripts, run-of-show. Complete coverage of all art types. */}
                        {(() => {
                          const artsItems = getArtsSmartNotes(segment, 'projection', language);
                          if (artsItems.length === 0) return null;
                          return (
                            <div className="bg-pink-50 px-1 py-0.5 rounded border border-dashed border-pink-300 text-[10px]">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="font-bold text-pink-700">🎭 ARTES</span>
                                <span className="text-[8px] bg-white/80 border border-gray-200 text-gray-400 px-1 rounded-full">AUTO</span>
                              </div>
                              {artsItems.map((item, i) => (
                                <div key={i} className="leading-tight text-gray-700">
                                  {item.icon} {item.label}: {item.value}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {segment.projection_notes && (
                          <div className="bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                            <span className="font-bold text-slate-700">PROYECCIÓN:</span>
                            <span className="ml-1">{segment.projection_notes}</span>
                          </div>
                        )}

                        {!segment.has_video && getArtsSmartNotes(segment, 'projection', language).length === 0 && !segment.projection_notes && (
                          <span className="italic text-gray-400">Sin notas específicas</span>
                        )}
                      </div>
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