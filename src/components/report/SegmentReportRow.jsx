import React from "react";
import { Badge } from "@/components/ui/badge";
import { Languages, Mic, Utensils } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

// Helper to calculate action time based on segment timing and offset
function calculateActionTime(segment, action) {
  const segmentStart = segment.start_time;
  const segmentEnd = segment.end_time;
  if (!segmentStart) return null;
  
  const [startH, startM] = segmentStart.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  
  let endMinutes = startMinutes + (segment.duration_min || 0);
  if (segmentEnd) {
    const [endH, endM] = segmentEnd.split(':').map(Number);
    endMinutes = endH * 60 + endM;
  }
  
  const offset = action.offset_min || 0;
  let targetMinutes;
  
  switch (action.timing) {
    case 'before_start':
      targetMinutes = startMinutes - offset;
      break;
    case 'after_start':
      targetMinutes = startMinutes + offset;
      break;
    case 'before_end':
      targetMinutes = endMinutes - offset;
      break;
    case 'absolute':
      return action.absolute_time ? formatTimeToEST(action.absolute_time) : null;
    default:
      return null;
  }
  
  if (targetMinutes < 0) targetMinutes += 24 * 60;
  const h = Math.floor(targetMinutes / 60) % 24;
  const m = targetMinutes % 60;
  return formatTimeToEST(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export default function SegmentReportRow({
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
        {segment.projection_notes && (
          <div className="bg-slate-100 px-0.5 py-0.5 rounded border border-slate-300 text-[9px]">
            <span className="font-bold text-slate-700">PROYECCIÓN:</span>
            <span className="ml-0.5">{segment.projection_notes}</span>
          </div>
        )}
        {segment.sound_notes && (
          <div className="bg-red-50 px-0.5 py-0.5 rounded border border-red-200 text-[9px]">
            <span className="font-bold text-red-700">SONIDO:</span>
            <span className="ml-0.5">{segment.sound_notes}</span>
          </div>
        )}
        {segment.ushers_notes && (
          <div className="bg-green-50 px-0.5 py-0.5 rounded border border-green-200 text-[9px]">
            <span className="font-bold text-green-700">UJIERES:</span>
            <span className="ml-0.5">{segment.ushers_notes}</span>
          </div>
        )}
        {segment.stage_decor_notes && (
          <div className="bg-purple-50 px-0.5 py-0.5 rounded border border-purple-200 text-[9px]">
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
              <span className="ml-0.5 text-gray-600">- {segment.translation_notes}</span>
            )}
          </div>
        )}
        {segment.microphone_assignments && (
          <div className="bg-red-50 px-0.5 py-0.5 rounded border border-red-200 text-[9px]">
            <span className="font-bold text-red-700">MICS:</span>
            <span className="ml-0.5">{segment.microphone_assignments}</span>
          </div>
        )}
        {segment.other_notes && (
          <div className="bg-gray-50 px-0.5 py-0.5 rounded border border-gray-200 text-[9px]">
            <span className="font-bold text-gray-700">OTRO:</span>
            <span className="ml-0.5">{segment.other_notes}</span>
          </div>
        )}
        {!segment.projection_notes && !segment.sound_notes && !segment.ushers_notes && !segment.requires_translation && !segment.stage_decor_notes && !segment.microphone_assignments && !segment.other_notes && (
          <span className="text-gray-400 text-[9px]">-</span>
        )}
      </div>
    );
  }

  // Render details column with dual-column layout (compressed)
  return (
    <div className={durantActions.length > 0 ? "grid grid-cols-2 gap-1" : ""}>
      <div className={durantActions.length > 0 ? "space-y-0.5" : "space-y-0.5"}>
        <div className="text-gray-900 font-bold uppercase text-[10px]">
          {segment.title}
        </div>
        
        {segment.segment_type && (
          <Badge variant="outline" className="text-[9px] px-0.5 py-0 h-fit w-fit">
            {segment.segment_type}
          </Badge>
        )}

        {segment.presenter && (
          <div className="text-blue-600 font-semibold text-[10px]">
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

        {segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0 && (
          <div className="text-[9px] bg-pink-50 px-0.5 py-0.5 rounded border border-pink-200 leading-tight">
            <span className="text-pink-700 font-bold">ARTES:</span>
            <span className="text-gray-700 ml-0.5">{segment.art_types.map(t => t === "DANCE" ? "Danza" : t === "DRAMA" ? "Drama" : t === "VIDEO" ? "Video" : "Otro").join(", ")}</span>

            {segment.art_types.includes("DRAMA") && (
              <div className="mt-0.5 pl-1 border-l border-pink-300">
                {segment.drama_handheld_mics > 0 && <span className="inline">{t('arts.mics.handheld')}: {segment.drama_handheld_mics} • </span>}
                {segment.drama_headset_mics > 0 && <span className="inline">{t('arts.mics.headset')}: {segment.drama_headset_mics} • </span>}
                {segment.drama_start_cue && <span className="inline">{t('arts.cues.start')}: {segment.drama_start_cue} • </span>}
                {segment.drama_end_cue && <span className="inline">{t('arts.cues.end')}: {segment.drama_end_cue}</span>}
                {segment.drama_has_song && segment.drama_song_title && (
                  <div>{t('arts.song')}: {segment.drama_song_title}</div>
                )}
                {segment.microphone_assignments && (
                  <div className="text-gray-700">Mics: {segment.microphone_assignments}</div>
                )}
              </div>
            )}

            {segment.art_types.includes("DANCE") && (
              <div className="mt-0.5 pl-1 border-l border-pink-300">
                {segment.dance_has_song && segment.dance_song_title && (
                  <span className="inline">{t('arts.music')}: {segment.dance_song_title} • </span>
                )}
                {segment.dance_handheld_mics > 0 && <span className="inline">{t('arts.mics.handheld')}: {segment.dance_handheld_mics} • </span>}
                {segment.dance_headset_mics > 0 && <span className="inline">{t('arts.mics.headset')}: {segment.dance_headset_mics}</span>}
              </div>
            )}

            {segment.art_types.includes("OTHER") && segment.art_other_description && (
              <div className="mt-0.5 text-gray-600">
                {segment.art_other_description}
              </div>
            )}
          </div>
        )}

        {segment.prep_instructions && (
          <div className="text-[9px] bg-amber-50 px-0.5 py-0.5 rounded border border-amber-200">
            <span className="text-amber-700 font-bold">PREP:</span>
            <span className="text-gray-700 ml-0.5 italic">{segment.prep_instructions}</span>
          </div>
        )}

        {segment.description_details && (
          <div className="text-gray-600 text-[9px]">
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
}