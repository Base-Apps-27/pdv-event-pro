import React from "react";
import { Badge } from "@/components/ui/badge";
import { Languages, Mic, Utensils } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function SegmentReportRow({
  segment,
  idx,
  getSegmentActions,
  isPrepAction,
  getRoomName,
  departmentColors,
  t,
  isBreakout = false,
}) {
  const prepActions = getSegmentActions(segment).filter(a => isPrepAction(a));
  const durantActions = getSegmentActions(segment).filter(a => !isPrepAction(a));

  return (
    <div className="flex flex-col">
      {/* Prep Actions Row - full width above segment */}
      {prepActions.length > 0 && (
        <div className="bg-amber-50 border-t-2 border-amber-300 p-2 mb-2">
          <div className="flex items-start gap-2">
            <div className="bg-amber-500 text-white px-2 py-1 rounded font-bold text-[10px] uppercase whitespace-nowrap">
              ⚠ PREP
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
              {prepActions.map((action, actionIdx) => (
                <div
                  key={actionIdx}
                  className={`text-[10px] px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                >
                  <span className="font-bold">[{action.department}]</span> {action.label}
                  {action.is_required && <span className="ml-1 text-red-600">*</span>}
                  {action.timing && action.offset_min !== undefined && (
                    <span className="italic ml-1">
                      ({action.timing === "before_start" && `${action.offset_min}m antes`}
                      {action.timing === "before_end" && `${action.offset_min}m antes de fin`}
                      {action.timing === "absolute" && action.absolute_time})
                    </span>
                  )}
                  {action.notes && <span className="ml-1">— {action.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Segment Row - Flex Layout (3 independent columns) */}
      <div className={`flex gap-0 border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${prepActions.length === 0 && idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
        
        {/* Column 1: HORA (narrow, fixed width, top-aligned) */}
        <div className="p-2 font-bold text-center border-r border-gray-200 text-[10px] flex-shrink-0 w-20" style={{ color: '#8DC63F', verticalAlign: 'top' }}>
          <div className="flex flex-col items-center leading-tight">
            <div className="whitespace-nowrap">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
            {segment.end_time && (
              <>
                <div className="text-gray-400 text-[8px]">↓</div>
                <div className="whitespace-nowrap">{formatTimeToEST(segment.end_time)}</div>
              </>
            )}
            {segment.duration_min && (
              <div className="text-[9px] text-gray-600 mt-0.5">({segment.duration_min}m)</div>
            )}
            {!isBreakout && (
              <div className="flex gap-1 mt-2">
                {segment.requires_translation && segment.translation_mode === "InPerson" && (
                  <>
                    <Languages className="w-3 h-3 text-purple-600" title="Traducción en Persona" />
                    <Mic className="w-3 h-3 text-purple-600" title="En Persona" />
                  </>
                )}
                {segment.requires_translation && segment.translation_mode === "RemoteBooth" && (
                  <Languages className="w-3 h-3 text-purple-600" title="Traducción Remota" />
                )}
                {segment.major_break && (
                  <Utensils className="w-3 h-3 text-orange-600" title="Receso Mayor" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: DETALLES (flex-grow, top-aligned) */}
        <div className="p-2 border-r border-gray-200 flex-grow min-w-0" style={{ verticalAlign: 'top' }}>
          <div className={durantActions.length > 0 ? "grid grid-cols-2 gap-2" : ""}>
            <div className={durantActions.length > 0 ? "space-y-1" : "grid grid-cols-2 gap-x-4 gap-y-1"}>
              <div className="text-gray-900 font-bold text-xs uppercase">
                {segment.title}
              </div>
              
              {segment.segment_type && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 w-fit">
                  {segment.segment_type}
                </Badge>
              )}

              {segment.presenter && (
                <div className="text-blue-600 font-semibold text-xs">
                  {segment.presenter}
                </div>
              )}

              {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                <div className="mt-1 text-[10px] bg-green-50 p-1 rounded border border-green-200">
                  <span className="text-green-700 font-bold">CANCIONES:</span>
                  <div className="mt-0.5">
                    {[...Array(segment.number_of_songs)].map((_, idx) => {
                      const songNum = idx + 1;
                      const title = segment[`song_${songNum}_title`];
                      const lead = segment[`song_${songNum}_lead`];
                      if (!title) return null;
                      return (
                        <div key={songNum} className="text-gray-700">
                          {songNum}. {title} {lead && `(${lead})`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {segment.segment_type === "Plenaria" && segment.message_title && (
                <div className="mt-1 text-[10px] bg-blue-50 p-1 rounded border border-blue-200">
                  <span className="text-blue-700 font-bold">MENSAJE:</span>
                  <span className="text-gray-700 ml-1">{segment.message_title}</span>
                </div>
              )}

              {segment.has_video && (
                <div className="mt-1 text-[10px] bg-blue-50 p-1 rounded border border-blue-200">
                  <span className="text-blue-700 font-bold">VIDEO:</span>
                  <span className="text-gray-700 ml-1">{segment.video_name}</span>
                  {segment.video_location && <span className="text-gray-600 ml-1">({segment.video_location})</span>}
                  {typeof segment.video_length_sec === 'number' && (
                    <span className="text-gray-600 ml-1">- {Math.floor(segment.video_length_sec / 60)}:{String(segment.video_length_sec % 60).padStart(2, '0')}</span>
                  )}
                  {segment.video_owner && <span className="text-gray-600 ml-1">• {segment.video_owner}</span>}
                </div>
              )}

              {segment.segment_type === "Panel" && (segment.panel_moderators || segment.panel_panelists) && (
                <div className="mt-1 text-[10px] bg-amber-50 p-1 rounded border border-amber-200">
                  {segment.panel_moderators && (
                    <div>
                      <span className="text-amber-700 font-bold">MODERADOR(ES):</span>
                      <span className="text-gray-700 ml-1"> {segment.panel_moderators}</span>
                    </div>
                  )}
                  {segment.panel_panelists && (
                    <div>
                      <span className="text-amber-700 font-bold">PANELISTA(S):</span>
                      <span className="text-gray-700 ml-1"> {segment.panel_panelists}</span>
                    </div>
                  )}
                </div>
              )}

              {segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0 && (
                <div className="mt-1 text-[10px] bg-pink-50 p-1 rounded border border-pink-200">
                  <span className="text-pink-700 font-bold">ARTES:</span>
                  <span className="text-gray-700 ml-1">{segment.art_types.map(t => t === "DANCE" ? "Danza" : t === "DRAMA" ? "Drama" : t === "VIDEO" ? "Video" : "Otro").join(", ")}</span>

                  {segment.art_types.includes("DRAMA") && (
                    <div className="mt-0.5 pl-2 border-l-2 border-pink-300">
                      {segment.drama_handheld_mics > 0 && <div>{t('arts.mics.handheld')}: {segment.drama_handheld_mics}</div>}
                      {segment.drama_headset_mics > 0 && <div>{t('arts.mics.headset')}: {segment.drama_headset_mics}</div>}
                      {segment.drama_start_cue && <div>{t('arts.cues.start')}: {segment.drama_start_cue}</div>}
                      {segment.drama_end_cue && <div>{t('arts.cues.end')}: {segment.drama_end_cue}</div>}
                      {segment.drama_has_song && segment.drama_song_title && (
                        <div>{t('arts.song')}: {segment.drama_song_title}</div>
                      )}
                      {segment.microphone_assignments && (
                        <div className="mt-0.5 text-gray-700">Asignación de micrófonos: {segment.microphone_assignments}</div>
                      )}
                    </div>
                  )}

                  {segment.art_types.includes("DANCE") && (
                    <div className="mt-0.5 pl-2 border-l-2 border-pink-300">
                      {segment.dance_has_song && segment.dance_song_title && (
                        <div>{t('arts.music')}: {segment.dance_song_title}</div>
                      )}
                      {segment.dance_handheld_mics > 0 && <div>{t('arts.mics.handheld')}: {segment.dance_handheld_mics}</div>}
                      {segment.dance_headset_mics > 0 && <div>{t('arts.mics.headset')}: {segment.dance_headset_mics}</div>}
                    </div>
                  )}

                  {segment.art_types.includes("OTHER") && segment.art_other_description && (
                    <div className="mt-0.5 text-gray-600">
                      {segment.art_other_description}
                    </div>
                  )}
                </div>
              )}

              {segment.description_details && (
                <div className="text-gray-600 text-[10px] mt-1">
                  {segment.description_details}
                </div>
              )}
            </div>

            {/* In-segment cues shown in the details column */}
            {durantActions.length > 0 && (
              <div className="border-l border-gray-200 pl-2">
                <div className="text-[10px] space-y-0.5">
                  <div className="font-bold uppercase text-blue-700 mb-0.5 flex items-center gap-1">
                    <span className="bg-blue-100 px-1 rounded">▶ DURANTE</span>
                  </div>
                  {durantActions.map((action, actionIdx) => (
                    <div
                      key={actionIdx}
                      className={`p-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                    >
                      <div className="flex items-start gap-1">
                        <div className="flex-1">
                          <div className="font-semibold">
                            [{action.department}] {action.label}
                            {action.is_required && <span className="ml-1 text-red-600">*</span>}
                          </div>
                          {action.timing && action.offset_min !== undefined && (
                            <div className="italic">
                              {action.timing === "before_start" && `${action.offset_min} min antes de iniciar`}
                              {action.timing === "after_start" && `${action.offset_min} min después de iniciar`}
                              {action.timing === "before_end" && `${action.offset_min} min antes de terminar`}
                              {action.timing === "absolute" && action.absolute_time}
                            </div>
                          )}
                          {action.notes && <div>{action.notes}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: NOTAS POR EQUIPO (flex-grow, top-aligned) */}
        <div className="p-2 text-gray-600 text-[10px] flex-grow min-w-0" style={{ verticalAlign: 'top' }}>
          <div className="space-y-1">
            {segment.projection_notes && (
              <div className="bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                <span className="font-bold text-purple-700">PROYECCIÓN:</span>
                <span className="ml-1">{segment.projection_notes}</span>
              </div>
            )}
            {segment.sound_notes && (
              <div className="bg-red-50 px-1 py-0.5 rounded border border-red-200">
                <span className="font-bold text-red-700">SONIDO:</span>
                <span className="ml-1">{segment.sound_notes}</span>
              </div>
            )}
            {segment.ushers_notes && (
              <div className="bg-green-50 px-1 py-0.5 rounded border border-green-200">
                <span className="font-bold text-green-700">UJIERES:</span>
                <span className="ml-1">{segment.ushers_notes}</span>
              </div>
            )}
            {segment.stage_decor_notes && (
              <div className="bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                <span className="font-bold text-purple-700">STAGE & DECOR:</span>
                <span className="ml-1">{segment.stage_decor_notes}</span>
              </div>
            )}
            {segment.requires_translation && (
              <div className="bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                <span className="font-bold text-blue-700">TRADUCCIÓN:</span>
                {segment.translator_name && (
                  <span className="ml-1">{segment.translator_name}</span>
                )}
                {segment.translation_mode === "RemoteBooth" && (
                  <span className="ml-1 italic">(Remoto)</span>
                )}
                {segment.translation_notes && (
                  <span className="ml-1">- {segment.translation_notes}</span>
                )}
              </div>
            )}
            {!segment.projection_notes && !segment.sound_notes && !segment.ushers_notes && !segment.requires_translation && !segment.stage_decor_notes && (
              <span className="text-gray-400">-</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}