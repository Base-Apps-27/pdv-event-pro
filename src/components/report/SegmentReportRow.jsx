// Phase 7: Wrapped with React.memo for report rendering performance
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Languages, Mic, Utensils } from "lucide-react";
// Phase 3D: calculateActionTime deduplicated — single source in reportHelpers
import { calculateActionTime } from "./reportHelpers";

// Phase 7: Memoized — pure display component, re-renders only on prop changes
const SegmentReportRow = React.memo(function SegmentReportRow({
  segment,
  getSegmentActions,
  isPrepAction,
  t,
  showOnlyTeamNotes = false,
  departmentColors,
}) {
  const durantActions = getSegmentActions ? getSegmentActions(segment).filter(a => !isPrepAction(a)) : [];

  // If showOnlyTeamNotes, render only team notes column
  if (showOnlyTeamNotes) {
    return (
      <div className="space-y-0.5">
        {/* 2026-02-28: Added COORDINACIÓN — was missing from HTML report (present in PDF + entity) */}
        {/* 2026-03-01: All notes fields use whitespace-pre-wrap to preserve line breaks.
         * Decision: "Notes fields must always preserve line breaks" */}
        {segment.coordinator_notes && (
          <div className="bg-orange-50 px-0.5 py-0.5 rounded border border-orange-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-orange-600">COORDINACIÓN:</span>
            <span className="ml-0.5">{segment.coordinator_notes}</span>
          </div>
        )}
        {segment.projection_notes && (
          <div className="bg-slate-100 px-0.5 py-0.5 rounded border border-slate-300 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-slate-700">PROYECCIÓN:</span>
            <span className="ml-0.5">{segment.projection_notes}</span>
          </div>
        )}
        {segment.sound_notes && (
          <div className="bg-red-50 px-0.5 py-0.5 rounded border border-red-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-red-700">SONIDO:</span>
            <span className="ml-0.5">{segment.sound_notes}</span>
          </div>
        )}
        {segment.ushers_notes && (
          <div className="bg-green-50 px-0.5 py-0.5 rounded border border-green-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-green-700">UJIERES:</span>
            <span className="ml-0.5">{segment.ushers_notes}</span>
          </div>
        )}
        {segment.stage_decor_notes && (
          <div className="bg-purple-50 px-0.5 py-0.5 rounded border border-purple-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-purple-700">STAGE & DECOR:</span>
            <span className="ml-0.5">{segment.stage_decor_notes}</span>
          </div>
        )}
        {/* Only show booth translation in notes column - stage translation is shown inline with presenter */}
        {segment.requires_translation && segment.translation_mode === "RemoteBooth" && (
          <div className="bg-purple-50 px-0.5 py-0.5 rounded border border-purple-200 text-[9px]">
            <span className="font-bold text-purple-700">🎧 TRAD-CABINA:</span>
            {segment.translator_name && (
              <span className="ml-0.5 font-semibold">{segment.translator_name}</span>
            )}
            {segment.translation_notes && (
              <span className="ml-0.5 text-gray-600 whitespace-pre-wrap">- {segment.translation_notes}</span>
            )}
          </div>
        )}
        {/* 2026-02-28: Added LIVESTREAM — was missing from HTML report (present in PDF + entity) */}
        {segment.livestream_notes && (
          <div className="bg-cyan-50 px-0.5 py-0.5 rounded border border-cyan-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-cyan-700">LIVESTREAM:</span>
            <span className="ml-0.5">{segment.livestream_notes}</span>
          </div>
        )}
        {segment.microphone_assignments && (
          <div className="bg-red-50 px-0.5 py-0.5 rounded border border-red-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-red-700">MICS:</span>
            <span className="ml-0.5">{segment.microphone_assignments}</span>
          </div>
        )}
        {segment.other_notes && (
          <div className="bg-gray-50 px-0.5 py-0.5 rounded border border-gray-200 text-[9px] whitespace-pre-wrap">
            <span className="font-bold text-gray-700">OTRO:</span>
            <span className="ml-0.5">{segment.other_notes}</span>
          </div>
        )}
        {/* 2026-02-28: Smart-routed arts AUTO blocks REMOVED from Detailed Report notes column.
         * Rationale: Detailed shows ALL departments + full arts detail in the details column,
         * so per-department AUTO routing just duplicates the same data across 5 dept blocks.
         * AUTO routing remains on filtered surfaces: MyProgram (per dept), individual HTML reports,
         * individual PDF reports. See Decision: "Smart routing only on filtered views". */}
        {!segment.coordinator_notes && !segment.projection_notes && !segment.sound_notes && !segment.ushers_notes && !segment.requires_translation && !segment.stage_decor_notes && !segment.livestream_notes && !segment.microphone_assignments && !segment.other_notes && (
          <span className="text-gray-400 text-[9px]">-</span>
        )}
      </div>
    );
  }

  // Render details column with dual-column layout (compressed)
  return (
    <div className={durantActions.length > 0 ? "grid grid-cols-2 gap-1" : ""}>
      <div className={durantActions.length > 0 ? "space-y-0.5" : "space-y-0.5"}>
        <div className="text-gray-900 font-bold uppercase text-[10px] flex items-center flex-wrap gap-1">
          <span>{segment.title}</span>
          {((segment.presentation_url && segment.presentation_url.length > 0) || (segment.notes_url && segment.notes_url.length > 0) || segment.content_is_slides_only) && (
            <span title="Recursos adjuntos" className="text-blue-500 bg-blue-50 px-1 rounded text-[8px] flex items-center gap-0.5"><span className="text-[10px]">📎</span> RECURSOS</span>
          )}
          {(segment.parsed_verse_data?.key_takeaways?.length > 0 || segment.scripture_references) && (
            <span title="Versículos adjuntos" className="text-amber-600 bg-amber-50 px-1 rounded text-[8px] flex items-center gap-0.5"><span className="text-[10px]">💡</span> VERSOS</span>
          )}
        </div>
        
        {segment.segment_type && (
          <Badge variant="outline" className="text-[9px] px-0.5 py-0 h-fit w-fit">
            {segment.segment_type}
          </Badge>
        )}

        {segment.presenter && (
          <div className={`font-semibold text-[10px] ${segment.segment_type === 'Alabanza' ? 'text-green-600' : 'text-blue-600'}`}>
            {['Break', 'Receso', 'Almuerzo'].includes(segment.segment_type) 
              ? `Encargado: ${segment.presenter}` 
              : segment.presenter}
          </div>
        )}

        {/* Break type visual distinction */}
        {['Receso', 'Almuerzo'].includes(segment.segment_type) && (
          <div className={`text-[9px] px-1 py-0.5 rounded border mt-0.5 inline-flex items-center gap-1 ${
            segment.segment_type === 'Almuerzo' 
              ? 'bg-orange-100 border-orange-300 text-orange-800' 
              : 'bg-gray-100 border-gray-300 text-gray-700'
          }`}>
            <span>{segment.segment_type === 'Almuerzo' ? '🍽️' : '☕'}</span>
            <span className="font-semibold">{segment.duration_min} min</span>
          </div>
        )}

        {/* Translation for breaks - purple for all translation items */}
        {['Receso', 'Almuerzo'].includes(segment.segment_type) && segment.requires_translation && (
          <div className="text-[9px] px-1 py-0.5 rounded border mt-0.5 inline-flex items-center gap-1 bg-purple-100 border-purple-300 text-purple-800">
            <span>{segment.translation_mode === 'InPerson' ? '🎙️' : '🎧'}</span>
            <span className="font-semibold">{segment.translation_mode === 'InPerson' ? 'TRAD-TARIMA' : 'TRAD-CABINA'}</span>
            {segment.translator_name && <span>: {segment.translator_name}</span>}
          </div>
        )}

        {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
          <div className="text-[9px] bg-green-50 px-0.5 py-0.5 rounded border border-green-200">
            <span className="text-green-700 font-bold">CANCIONES:</span>
            {[...Array(segment.number_of_songs)].map((_, idx) => {
              const songNum = idx + 1;
              const title = segment[`song_${songNum}_title`];
              const lead = segment[`song_${songNum}_lead`];
              const key = segment[`song_${songNum}_key`];
              if (!title) return null;
              return (
                <div key={songNum} className="text-gray-700 leading-tight">
                  {songNum}. {title} {lead && `(${lead})`} {key && <span className="text-gray-500 font-semibold">[{key}]</span>}
                </div>
              );
            })}
          </div>
        )}

        {segment.segment_type === "Plenaria" && segment.message_title && (
          <div className="text-[9px] bg-blue-50 px-0.5 py-0.5 rounded border border-blue-200">
            <span className="text-blue-700 font-bold">MENSAJE:</span>
            <span className="text-gray-700 ml-0.5">{segment.message_title}</span>
          </div>
        )}

        {segment.has_video && (
          <div className="text-[9px] bg-blue-50 px-0.5 py-0.5 rounded border border-blue-200">
            <span className="text-blue-700 font-bold">VIDEO:</span>
            <span className="text-gray-700 ml-0.5">{segment.video_name}</span>
            {segment.video_location && <span className="text-gray-600 ml-0.5">({segment.video_location})</span>}
            {typeof segment.video_length_sec === 'number' && (
              <span className="text-gray-600 ml-0.5">- {Math.floor(segment.video_length_sec / 60)}:{String(segment.video_length_sec % 60).padStart(2, '0')}</span>
            )}
            {segment.video_owner && <span className="text-gray-600 ml-0.5">• {segment.video_owner}</span>}
          </div>
        )}

        {segment.segment_type === "Panel" && (segment.panel_moderators || segment.panel_panelists) && (
          <div className="text-[9px] bg-amber-50 px-0.5 py-0.5 rounded border border-amber-200">
            {segment.panel_moderators && (
              <div>
                <span className="text-amber-700 font-bold">MOD:</span>
                <span className="text-gray-700 ml-0.5"> {segment.panel_moderators}</span>
              </div>
            )}
            {segment.panel_panelists && (
              <div>
                <span className="text-amber-700 font-bold">PAN:</span>
                <span className="text-gray-700 ml-0.5"> {segment.panel_panelists}</span>
              </div>
            )}
          </div>
        )}

        {/* 2026-02-28: Arts summary — types, order, key media/people only.
         * Full operational detail lives in the Resources modal (interactive) or
         * is routed to department-specific reports via smart routing.
         * This summary is designed to survive as a print fallback. */}
        {segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0 && (() => {
          const TYPE_SHORT = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };
          const savedOrder = segment.arts_type_order || [];
          const orderedTypes = savedOrder.length > 0
            ? [...savedOrder].filter(i => segment.art_types.includes(i.type)).sort((a, b) => (a.order || 0) - (b.order || 0)).map(i => i.type)
            : segment.art_types;
          const inOrder = new Set(orderedTypes);
          const allTypes = [...orderedTypes, ...segment.art_types.filter(t => !inOrder.has(t))];

          const mediaItems = [];
          allTypes.forEach(type => {
            if (type === 'DRAMA') {
              if (segment.drama_song_title) mediaItems.push({ type: 'Drama', label: segment.drama_song_title, person: segment.drama_song_owner });
              if (segment.drama_song_2_title) mediaItems.push({ type: 'Drama', label: segment.drama_song_2_title, person: segment.drama_song_2_owner });
              if (segment.drama_song_3_title) mediaItems.push({ type: 'Drama', label: segment.drama_song_3_title, person: segment.drama_song_3_owner });
            }
            if (type === 'DANCE') {
              if (segment.dance_song_title) mediaItems.push({ type: 'Danza', label: segment.dance_song_title, person: segment.dance_song_owner });
              if (segment.dance_song_2_title) mediaItems.push({ type: 'Danza', label: segment.dance_song_2_title, person: segment.dance_song_2_owner });
              if (segment.dance_song_3_title) mediaItems.push({ type: 'Danza', label: segment.dance_song_3_title, person: segment.dance_song_3_owner });
            }
            if (type === 'VIDEO' && segment.video_name) mediaItems.push({ type: 'Video', label: segment.video_name, person: segment.video_owner });
            if (type === 'SPOKEN_WORD' && segment.spoken_word_speaker) mediaItems.push({ type: 'SW', label: segment.spoken_word_description || 'Spoken Word', person: segment.spoken_word_speaker });
            if (type === 'OTHER' && segment.art_other_description) mediaItems.push({ type: 'Otro', label: segment.art_other_description });
          });

          return (
            <div className="text-[9px] bg-pink-50 px-0.5 py-0.5 rounded border border-pink-200 leading-tight">
              <span className="text-pink-700 font-bold">ARTES:</span>
              <span className="text-gray-700 ml-0.5">
                {allTypes.length > 1
                  ? allTypes.map(t => TYPE_SHORT[t] || t).join(' → ')
                  : allTypes.map(t => TYPE_SHORT[t] || t).join(', ')}
              </span>
              {mediaItems.length > 0 && (
                <div className="mt-0.5 pl-1 border-l border-pink-300">
                  {mediaItems.map((item, i) => (
                    <div key={i}>
                      <span className="text-pink-600 font-semibold">{item.type}:</span>{' '}
                      {item.label}{item.person ? ` — ${item.person}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Sub-Assignments (Ministración / worship sub-roles) — matching editor + PDF */}
        {/* 2026-02-28: Added — was present in editor + weekly PDF but missing from HTML report */}
        {Array.isArray(segment.ui_sub_assignments) && segment.ui_sub_assignments.length > 0 && (
          <div className="text-[9px] bg-purple-50 px-0.5 py-0.5 rounded border border-purple-200">
            {segment.ui_sub_assignments.map((sub, subIdx) => {
              const val = segment[sub.person_field_name] || '';
              if (!val) return null;
              return (
                <div key={subIdx}>
                  <span className="font-bold text-purple-700">{sub.label}:</span>
                  <span className="text-purple-900 ml-0.5">{val}</span>
                  {sub.duration_min ? <span className="text-gray-500 ml-0.5">({sub.duration_min}m)</span> : null}
                </div>
              );
            })}
          </div>
        )}

        {segment.prep_instructions && (
          <div className="text-[9px] bg-amber-50 px-0.5 py-0.5 rounded border border-amber-200 whitespace-pre-wrap">
            <span className="text-amber-700 font-bold">PREP:</span>
            <span className="text-gray-700 ml-0.5 italic">{segment.prep_instructions}</span>
          </div>
        )}

        {segment.description_details && (
          <div className="text-gray-600 text-[9px] whitespace-pre-wrap">
            {segment.description_details}
          </div>
        )}
      </div>

      {/* During Actions Column - right side of details section */}
      {durantActions.length > 0 && (
        <div className="border-l border-gray-200 pl-1">
          <div className="text-[9px] space-y-0.5">
            <div className="font-bold uppercase text-blue-700 text-[8px]">▶ DURANTE</div>
            {durantActions.map((action, actionIdx) => {
              const actionTime = calculateActionTime(segment, action);
              return (
                <div
                  key={actionIdx}
                  className={`p-0.5 rounded border text-[8px] leading-tight ${departmentColors[action.department] || departmentColors.Other}`}
                >
                  <div className="font-semibold flex items-center gap-1 flex-wrap">
                    <span>[{action.department}] {action.label}</span>
                    {action.is_required && <span className="text-red-600">*</span>}
                    {actionTime && (
                      <span className="font-mono text-[7px] bg-blue-100 text-blue-700 px-1 rounded">@ {actionTime}</span>
                    )}
                  </div>
                  {action.notes && <div className="text-[8px]">{action.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default SegmentReportRow;