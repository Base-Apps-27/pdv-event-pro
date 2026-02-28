/**
 * Sound Report View — Time/title/presenter/sound notes table
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-3c)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 */
import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import PreSessionDetailsBlock from "./PreSessionDetailsBlock";
// 2026-02-28: Smart routing surfaces arts data relevant to sound (mics, cues, tracks, durations)
import { getArtsSmartNotes } from "@/components/utils/artsSmartRouting";

export default function SoundReportView({ eventSessions, getSessionSegments, allPreSessionDetails }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_sound');
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className="print-session">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg mb-4 border border-red-200">
              <h3 className="text-xl text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <PreSessionDetailsBlock sessionId={session.id} allPreSessionDetails={allPreSessionDetails} />

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-red-50 border-b-2 border-red-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Responsable</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Sonido</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.sound_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-gray-700">{segment.presenter || "-"}</td>
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
                         * getArtsSmartNotes('sound') returns only sound-relevant items:
                         * mics, cues, tracks, durations. Complete coverage of all art types. */}
                        {(() => {
                          const artsItems = getArtsSmartNotes(segment, 'sound', language);
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

                        {segment.sound_notes && (
                          <div className="bg-red-50 px-1 py-0.5 rounded border border-red-200">
                            <span className="font-bold text-red-700">SONIDO:</span>
                            <span className="ml-1">{segment.sound_notes}</span>
                          </div>
                        )}

                        {!segment.has_video && getArtsSmartNotes(segment, 'sound', language).length === 0 && !segment.sound_notes && (
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