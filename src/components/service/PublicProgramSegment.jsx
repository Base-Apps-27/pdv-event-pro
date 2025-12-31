import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Languages, Mic, Users, MapPin, BookOpen } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { getSegmentData, getNormalizedSongs } from "@/components/utils/segmentDataUtils";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function PublicProgramSegment({ 
  segment, 
  isCurrent, 
  isUpcoming, 
  viewMode, 
  isExpanded,
  alwaysExpanded,
  onToggleExpand, 
  onOpenVerses,
  allSegments // Needed for calculating isUpcoming if logic moved here, but passed as boolean
}) {
  const getData = (field) => getSegmentData(segment, field);
  const segmentType = segment.segment_type || segment.type || getData('type') || 'Especial';
  const isSpecial = ['Especial', 'Special', 'special'].includes(segmentType);

  // Type-based visibility flags (Logic matching CustomServiceBuilder inputs)
  const isWorship = ['Alabanza', 'worship'].includes(segmentType);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType); // 'Message' legacy?
  const isOffering = ['Ofrenda', 'offering'].includes(segmentType);
  const isWelcome = ['Bienvenida', 'welcome'].includes(segmentType);
  
  // IDs for scrolling
  const title = getData('title') || 'Untitled';
  const startTime = getData('start_time') || '00:00';
  const baseId = segment.id || `${title}-${startTime}`;
  const domId = `segment-${baseId}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');

  // Show songs only for Worship segments
  const songs = isWorship ? getNormalizedSongs(segment).filter(s => s.title) : [];
  
  // Actions
  const rawActions = segment.actions || segment.segment_actions || getData('actions') || [];
  const actions = isSpecial 
    ? rawActions.filter(a => {
        const label = (a.label || '').toLowerCase();
        return !label.includes('pianista sube') && !label.includes('equipo de a&a sube');
      })
    : rawActions;

  const prepActions = actions.filter(a => a.timing === 'before_start');
  const duringActions = actions.filter(a => a.timing !== 'before_start');

  return (
    <div 
      id={domId}
      className={`p-4 transition-colors border-b last:border-b-0 scroll-mt-24 duration-500 ${isCurrent ? 'bg-yellow-100 border-l-4 border-l-yellow-500' : isUpcoming ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}
    >
      {isCurrent && (
        <div className="mb-2">
          <Badge className="bg-yellow-500 text-white animate-pulse">EN CURSO AHORA</Badge>
        </div>
      )}
      {isUpcoming && (
        <div className="mb-2">
          <Badge className="bg-blue-500 text-white">PRÓXIMO (15 min)</Badge>
        </div>
      )}

      {/* SIMPLE MODE */}
      {viewMode === "simple" && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Clock className="w-5 h-5 text-pdv-teal flex-shrink-0" />
              <div>
                <span className="font-bold text-lg text-gray-900">{getData('start_time') ? formatTimeToEST(getData('start_time')) : "-"}</span>
                {getData('end_time') && (
                  <span className="text-gray-600 ml-2">- {formatTimeToEST(getData('end_time'))}</span>
                )}
                {segment.duration_min && (
                  <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {isSpecial && (
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                )}
                {getData('title')}
              </h4>
              <Badge variant="outline" className="text-xs text-gray-700">{segmentType}</Badge>
            </div>

            <div className="space-y-1 mt-1">
              {/* Presenter: Show for types that aren't Worship (Leader) or Message (Preacher) */}
              {!isWorship && !isMessage && getData('presenter') && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">
                    {segmentType === 'Ministración' ? 'Ministra: ' : ''}
                    {normalizeName(getData('presenter'))}
                  </span>
                </div>
              )}
              {/* Leader: Show only for Worship */}
              {isWorship && getData('leader') && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Dirige: {normalizeName(getData('leader'))}</span>
                </div>
              )}
              {/* Preacher: Show only for Message */}
              {isMessage && getData('preacher') && (
                <div className="flex items-center gap-2 text-indigo-600 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Predica: {normalizeName(getData('preacher'))}</span>
                </div>
              )}
              {getData('translator') && (
                <div className="flex items-center gap-2 text-purple-600 text-sm">
                  <Languages className="w-4 h-4" />
                  <span className="font-semibold">Traductor: {normalizeName(getData('translator'))}</span>
                </div>
              )}
            </div>

            {/* Show Verses only for Message or Offering */}
            {(isMessage || isOffering) && (getData('scripture_references') || getData('verse') || getData('parsed_verse_data')) && (
              <div className="flex items-start gap-2 mt-2">
                {(getData('scripture_references') || getData('verse')) && (
                  <p className="text-xs text-gray-600 flex-1">📖 {getData('scripture_references') || getData('verse')}</p>
                )}
                {!(getData('scripture_references') || getData('verse')) && <div className="flex-1"></div>}
                {getData('parsed_verse_data') && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onOpenVerses({
                      parsedData: getData('parsed_verse_data'),
                      rawText: getData('scripture_references') || getData('verse')
                    })}
                    className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                    title="Ver Versículos"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {!alwaysExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpand(segment.id)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      )}

      {/* FULL RUN OF SHOW MODE */}
      {viewMode === "full" && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-pdv-teal flex-shrink-0" />
                <div>
                  <span className="font-bold text-lg">{getData('start_time') ? formatTimeToEST(getData('start_time')) : "-"}</span>
                  {getData('end_time') && (
                    <span className="text-gray-600 ml-2">- {formatTimeToEST(getData('end_time'))}</span>
                  )}
                  {segment.duration_min && (
                    <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {isSpecial && (
                    <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
                  )}
                  {getData('title')}
                </h4>
                <Badge variant="outline" className="text-xs text-gray-700">{segmentType}</Badge>
                {segment.requires_translation && (
                  <div className="flex items-center gap-1">
                    <Languages className="w-4 h-4 text-purple-600" />
                    {segment.translation_mode === "InPerson" && <Mic className="w-4 h-4 text-purple-600" />}
                  </div>
                )}
              </div>

              {!isWorship && !isMessage && getData('presenter') && (
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">
                    {segmentType === 'Ministración' ? 'Ministra: ' : ''}
                    {normalizeName(getData('presenter'))}
                  </span>
                </div>
              )}
              
              {isWorship && getData('leader') && (
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Dirige: {normalizeName(getData('leader'))}</span>
                </div>
              )}

              {isMessage && getData('preacher') && (
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Predica: {normalizeName(getData('preacher'))}</span>
                </div>
              )}

              {segment.room_id && (
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{/* Room name would require hook or prop, omitting for now in common component */}Room</span>
                </div>
              )}

              {(isMessage || isOffering) && (getData('scripture_references') || getData('verse') || getData('parsed_verse_data')) && (
                <div className="flex items-start gap-2">
                  {(getData('scripture_references') || getData('verse')) && (
                    <p className="text-xs text-gray-600 mb-1 flex-1">📖 {getData('scripture_references') || getData('verse')}</p>
                  )}
                  {!(getData('scripture_references') || getData('verse')) && <div className="flex-1"></div>}
                  {getData('parsed_verse_data') && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onOpenVerses({
                        parsedData: getData('parsed_verse_data'),
                        rawText: getData('scripture_references') || getData('verse')
                      })}
                      className="h-6 w-6 p-0 border border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white flex-shrink-0"
                      title="Ver Versículos"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prep Actions */}
          {prepActions.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-bold text-gray-700 text-sm mb-2">⚠ PREPARACIÓN</p>
              <div className="space-y-1">
                {prepActions.map((action, idx) => (
                  <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                    <span className="font-bold">[{action.department}]</span> {action.label}
                    {action.offset_min !== undefined && (
                      <span className="italic ml-1">({action.offset_min}m antes)</span>
                    )}
                    {action.notes && <span className="ml-1">— {action.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* During Actions */}
          {duringActions.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-bold text-gray-700 text-sm mb-2">▶ DURANTE SEGMENTO</p>
              <div className="space-y-1">
                {duringActions.map((action, idx) => (
                  <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                    <span className="font-bold">[{action.department}]</span> {action.label}
                    {action.notes && <span className="ml-1">— {action.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Notes */}
          <div className="grid md:grid-cols-2 gap-2">
            {getData('projection_notes') && (
              <div className="border-l-4 border-blue-500 pl-3 py-1 text-xs">
                <span className="font-bold text-blue-800">PROYECCIÓN:</span>
                <p className="mt-1 text-blue-900">{getData('projection_notes')}</p>
              </div>
            )}
            {getData('sound_notes') && (
              <div className="border-l-4 border-red-500 pl-3 py-1 text-xs">
                <span className="font-bold text-red-800">SONIDO:</span>
                <p className="mt-1 text-red-900">{getData('sound_notes')}</p>
              </div>
            )}
            {getData('ushers_notes') && (
              <div className="border-l-4 border-green-500 pl-3 py-1 text-xs">
                <span className="font-bold text-green-800">UJIERES:</span>
                <p className="mt-1 text-green-900">{getData('ushers_notes')}</p>
              </div>
            )}
            {getData('translation_notes') && (
              <div className="border-l-4 border-blue-500 pl-3 py-1 text-xs">
                <span className="font-bold text-blue-800">TRADUCCIÓN:</span>
                <p className="mt-1 text-blue-900">{getData('translation_notes')}</p>
              </div>
            )}
            {getData('stage_decor_notes') && (
              <div className="border-l-4 border-purple-500 pl-3 py-1 text-xs">
                <span className="font-bold text-purple-800">STAGE & DECOR:</span>
                <p className="mt-1 text-purple-900">{getData('stage_decor_notes')}</p>
              </div>
            )}
          </div>

          {/* Additional Details (Full Mode) */}
          {isExpanded && (
            <div className="border-t pt-3 space-y-2">
              {songs.length > 0 && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                  <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                  <div className="space-y-1">
                    {songs.map((song, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span>{idx + 1}. {song.title}</span>
                        {song.lead && <span className="text-gray-600">({song.lead})</span>}
                        {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getData('messageTitle') && (
                <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                  <p className="font-semibold text-blue-800">Mensaje: {getData('messageTitle')}</p>
                  {(getData('scripture_references') || getData('verse')) && (
                    <p className="mt-1">Escrituras: {getData('scripture_references') || getData('verse')}</p>
                  )}
                </div>
              )}

              {(getData('description_details') || getData('description')) && (
                <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
                  <p className="text-xs text-green-900 font-medium">
                    <strong>📝 Notas:</strong> {getData('description_details') || getData('description')}
                  </p>
                </div>
              )}
            </div>
          )}

          {!alwaysExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpand(segment.id)}
              className="mt-2"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Menos' : 'Más Detalles'}
            </Button>
          )}
        </div>
      )}

      {/* Expanded details in SIMPLE mode */}
      {viewMode === "simple" && isExpanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {(getData('description_details') || getData('description')) && (
            <div className="bg-green-50 border-l-4 border-green-500 p-2 mt-2 rounded-r">
              <p className="text-sm text-green-900 font-medium">
                <strong>📝 Notas:</strong> {getData('description_details') || getData('description')}
              </p>
            </div>
          )}

          {songs.length > 0 && (
            <div className="bg-slate-50 p-2 rounded border border-slate-200 text-sm">
              <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
              <div className="space-y-1">
                {songs.map((song, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span>{idx + 1}. {song.title}</span>
                    {song.lead && <span className="text-gray-600">({song.lead})</span>}
                    {song.key && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">{song.key}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {getData('messageTitle') && (
            <div className="bg-blue-50 p-2 rounded border border-blue-200 text-sm">
              <p className="font-semibold text-blue-800">Mensaje: {getData('messageTitle')}</p>
              {(getData('scripture_references') || getData('verse')) && (
                <p className="mt-1">Escrituras: {getData('scripture_references') || getData('verse')}</p>
              )}
            </div>
          )}

          {/* Team Notes - Always Visible in Operational View */}
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            {getData('coordinator_notes') && (
              <div className="bg-orange-50 border-l-4 border-orange-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-orange-800 block mb-1">COORDINACIÓN:</span>
                <p className="text-orange-900 leading-snug">{getData('coordinator_notes')}</p>
              </div>
            )}
            {getData('projection_notes') && (
              <div className="bg-blue-50 border-l-4 border-blue-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-blue-800 block mb-1">PROYECCIÓN:</span>
                <p className="text-blue-900 leading-snug">{getData('projection_notes')}</p>
              </div>
            )}
            {getData('sound_notes') && (
              <div className="bg-red-50 border-l-4 border-red-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-red-800 block mb-1">SONIDO:</span>
                <p className="text-red-900 leading-snug">{getData('sound_notes')}</p>
              </div>
            )}
            {getData('ushers_notes') && (
              <div className="bg-green-50 border-l-4 border-green-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-green-800 block mb-1">UJIERES:</span>
                <p className="text-green-900 leading-snug">{getData('ushers_notes')}</p>
              </div>
            )}
            {getData('translation_notes') && (
              <div className="bg-purple-50 border-l-4 border-purple-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-purple-800 block mb-1">TRADUCCIÓN:</span>
                <p className="text-purple-900 leading-snug">{getData('translation_notes')}</p>
              </div>
            )}
            {getData('stage_decor_notes') && (
              <div className="bg-pink-50 border-l-4 border-pink-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-pink-800 block mb-1">STAGE & DECOR:</span>
                <p className="text-pink-900 leading-snug">{getData('stage_decor_notes')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}