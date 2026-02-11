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

                        {segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0 && (
                          <div className="bg-pink-50 px-1 py-0.5 rounded border border-pink-200 text-[10px]">
                            <span className="font-bold text-pink-700">ARTES:</span>
                            <span className="text-gray-700 ml-1">{segment.art_types.map(at => at === "DANCE" ? "Danza" : at === "DRAMA" ? "Drama" : at === "VIDEO" ? "Video" : "Otro").join(", ")}</span>
                            {/* DRAMA: mics + cues + optional song title for sound */}
                            {segment.art_types.includes("DRAMA") && (
                              <div className="mt-0.5 pl-2 border-l-2 border-pink-300 space-y-0.5">
                                {segment.drama_handheld_mics > 0 && <div>{t('arts.mics.handheld')}: {segment.drama_handheld_mics}</div>}
                                {segment.drama_headset_mics > 0 && <div>{t('arts.mics.headset')}: {segment.drama_headset_mics}</div>}
                                {segment.drama_start_cue && <div>{t('arts.cues.start')}: {segment.drama_start_cue}</div>}
                                {segment.drama_end_cue && <div>{t('arts.cues.end')}: {segment.drama_end_cue}</div>}
                                {segment.drama_has_song && segment.drama_song_title && (
                                  <div>{t('arts.song')}: {segment.drama_song_title}</div>
                                )}
                              </div>
                            )}
                            {/* DANCE: mics + song title for sound */}
                            {segment.art_types.includes("DANCE") && (
                              <div className="mt-0.5 pl-2 border-l-2 border-pink-300">
                                {segment.dance_handheld_mics > 0 && <div>{t('arts.mics.handheld')}: {segment.dance_handheld_mics}</div>}
                                {segment.dance_headset_mics > 0 && <div>{t('arts.mics.headset')}: {segment.dance_headset_mics}</div>}
                                {segment.dance_has_song && segment.dance_song_title && (
                                  <div>{t('arts.music')}: {segment.dance_song_title}</div>
                                )}
                              </div>
                            )}
                            {segment.art_types.includes("OTHER") && segment.art_other_description && (
                              <div className="mt-0.5 text-gray-600">{segment.art_other_description}</div>
                            )}
                          </div>
                        )}

                        {segment.sound_notes && (
                          <div className="bg-red-50 px-1 py-0.5 rounded border border-red-200">
                            <span className="font-bold text-red-700">SONIDO:</span>
                            <span className="ml-1">{segment.sound_notes}</span>
                          </div>
                        )}

                        {!segment.has_video && !(segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0) && !segment.sound_notes && (
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