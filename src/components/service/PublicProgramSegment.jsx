import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Languages, Mic, Users, MapPin, BookOpen } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { getSegmentData, getNormalizedSongs } from "@/components/utils/segmentDataUtils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

/**
 * PublicProgramSegment Component
 * 
 * Displays a single segment within a service or event program.
 * 
 * CRITICAL BEHAVIOR:
 * - For Services (alwaysExpanded=true): ALL details are always visible (actions, notes, songs, etc.)
 * - For Events (alwaysExpanded=false): Details are toggleable based on viewMode and isExpanded
 * 
 * @param {Object} segment - The segment data (from Service.segments or Segment entity)
 * @param {boolean} isCurrent - Whether this segment is currently in progress
 * @param {boolean} isUpcoming - Whether this segment is upcoming (within 15 minutes)
 * @param {string} viewMode - "simple" or "full" (only relevant for events)
 * @param {boolean} isExpanded - Whether the segment is manually expanded by user
 * @param {boolean} alwaysExpanded - If true, all details are always shown (for services)
 * @param {function} onToggleExpand - Handler for expand/collapse button
 * @param {function} onOpenVerses - Handler for opening parsed verses modal
 * @param {Array} allSegments - All segments in the program (for context)
 */
export default function PublicProgramSegment({ 
  segment, 
  isCurrent, 
  isUpcoming, 
  viewMode, 
  isExpanded,
  alwaysExpanded,
  onToggleExpand, 
  onOpenVerses,
  allSegments,
  onOpenVerseParser
}) {
  // Language (for type label mapping)
  const { language } = useLanguage();
  // Helper to safely get segment data (checks data object first, then root)
  const getData = (field) => getSegmentData(segment, field);
  
  // Determine segment type and characteristics
  const segmentType = segment.segment_type || segment.type || getData('type') || 'Especial';
  const isSpecial = ['Especial', 'Special', 'special'].includes(segmentType);
  const isWorship = ['Alabanza', 'worship'].includes(segmentType);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
  const isOffering = ['Ofrenda', 'offering'].includes(segmentType);
  const isPanel = ['Panel', 'panel'].includes(segmentType);
  
  // Display mapping for type chip (keeps behavior checks above on raw value)
  const typeDisplayMap = {
    es: { worship: 'Alabanza', welcome: 'Bienvenida', offering: 'Ofrenda', message: 'Plenaria', panel: 'Panel' },
    en: { worship: 'Worship', welcome: 'Welcome', offering: 'Offering', message: 'Message', panel: 'Panel' }
  };
  const normalizedTypeKey = (segmentType || '').toString().toLowerCase();
  const displaySegmentType = typeDisplayMap[language]?.[normalizedTypeKey] || segmentType;
  
  // Generate stable DOM ID for scrolling
  const title = getData('title') || 'Untitled';
  const startTime = getData('start_time') || '00:00';
  const baseId = segment.id || `${title}-${startTime}`;
  const domId = `segment-${baseId}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');

  // Get songs (only for worship segments)
  const songs = isWorship ? getNormalizedSongs(segment).filter(s => s.title) : [];
  
  // Get and filter actions
  // Prefer new schema actions; fall back to legacy for safety
  const rawActions = segment.segment_actions || segment.actions || getData('actions') || [];
  const actions = isSpecial 
    ? rawActions.filter(a => {
        const label = (a.label || '').toLowerCase();
        // Filter out generic worship actions from special segments (data migration artifacts)
        return !label.includes('pianista sube') && !label.includes('equipo de a&a sube');
      })
    : rawActions;

  const prepActions = actions.filter(a => a.timing === 'before_start');
  const duringActions = actions.filter(a => a.timing !== 'before_start');

  // CRITICAL: Determine if details should be shown
  // - Services (alwaysExpanded=true): Always show all details
  // - Events in "full" mode: Always show all details
  // - Events in "simple" mode: Only show if user expanded
  const showDetails = alwaysExpanded || viewMode === "full" || isExpanded;

  return (
    <div 
      id={domId}
      className={`p-4 transition-colors border-b last:border-b-0 scroll-mt-24 duration-500 ${
        isCurrent 
          ? 'bg-yellow-100 border-l-4 border-l-yellow-500' 
          : isUpcoming 
            ? 'bg-blue-50 border-l-4 border-l-blue-500' 
            : 'hover:bg-gray-50'
      }`}
    >
      {/* Current/Upcoming Status Badges */}
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

      {/* Main Segment Header (Always Visible) */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Time Display */}
          <div className="flex items-center gap-3 mb-1">
            <Clock className="w-5 h-5 text-pdv-teal flex-shrink-0" />
            <div>
              <span className="font-bold text-lg text-gray-900">
                {getData('start_time') ? formatTimeToEST(getData('start_time')) : "-"}
              </span>
              {getData('end_time') && (
                <span className="text-gray-600 ml-2">- {formatTimeToEST(getData('end_time'))}</span>
              )}
              {segment.duration_min && (
                <span className="text-sm text-gray-600 ml-2">({segment.duration_min} min)</span>
              )}
            </div>
          </div>

          {/* Segment Title and Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {isSpecial && (
                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
              )}
              {getData('title')}
            </h4>
            <Badge variant="outline" className="text-xs text-gray-700">{displaySegmentType}</Badge>
            {segment.requires_translation && (
              <div className="flex items-center gap-1">
                <Languages className="w-4 h-4 text-purple-600" />
                {segment.translation_mode === "InPerson" && <Mic className="w-4 h-4 text-purple-600" />}
              </div>
            )}
          </div>

          {/* Presenter/Leader/Preacher/Translator Info */}
          <div className="space-y-1 mt-1">
           {/* Panel: Moderators & Panelists */}
           {isPanel && (getData('panel_moderators') || getData('panel_panelists')) && (
             <>
               {getData('panel_moderators') && (
                 <div className="flex items-center gap-2 text-amber-700 text-sm">
                   <Users className="w-4 h-4" />
                   <span className="font-semibold">{language === 'es' ? 'Moderador(es): ' : 'Moderator(s): '}{normalizeName(getData('panel_moderators'))}</span>
                 </div>
               )}
               {getData('panel_panelists') && (
                 <div className="flex items-center gap-2 text-amber-700 text-sm">
                   <Users className="w-4 h-4" />
                   <span className="font-semibold">{language === 'es' ? 'Panelista(s): ' : 'Panelist(s): '}{normalizeName(getData('panel_panelists'))}</span>
                 </div>
               )}
             </>
           )}
           {/* Presenter: Show for non-worship, non-message segments */}
           {!isWorship && !isMessage && !isPanel && getData('presenter') && (
             <div className="flex items-center gap-2 text-blue-600 text-sm">
               <Users className="w-4 h-4" />
               <span className="font-semibold">
                 {segmentType === 'Ministración' ? 'Ministra: ' : ''}
                 {normalizeName(getData('presenter'))}
               </span>
             </div>
           )}
           {/* Leader: Show only for Worship segments */}
           {isWorship && getData('leader') && (
             <div className="flex items-center gap-2 text-green-600 text-sm">
               <Users className="w-4 h-4" />
               <span className="font-semibold">Dirige: {normalizeName(getData('leader'))}</span>
             </div>
           )}
           {/* Preacher: Show only for Message segments */}
           {isMessage && getData('preacher') && (
             <div className="flex items-center gap-2 text-indigo-600 text-sm">
               <Users className="w-4 h-4" />
               <span className="font-semibold">Predica: {normalizeName(getData('preacher'))}</span>
             </div>
           )}
           {/* Translator: Show for all segments if present */}
           {getData('translator') && (
             <div className="flex items-center gap-2 text-purple-600 text-sm">
               <Languages className="w-4 h-4" />
               <span className="font-semibold">Traductor: {normalizeName(getData('translator'))}</span>
             </div>
           )}
           {/* Room: Show if segment has a specific room assignment */}
           {segment.room_id && (
             <div className="flex items-center gap-2 text-gray-600 text-sm">
               <MapPin className="w-4 h-4" />
               <span>Sala asignada</span>
             </div>
           )}
          </div>

          {/* Scripture References (for Message or Offering segments) */}
          {(isMessage || isOffering) && (getData('scripture_references') || getData('verse') || getData('parsed_verse_data')) && (
            <div className="flex items-start gap-2 mt-2">
              {(getData('scripture_references') || getData('verse')) && (
                <p className="text-xs text-gray-600 flex-1">
                  📖 {getData('scripture_references') || getData('verse')}
                </p>
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
              {isMessage && onOpenVerseParser && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onOpenVerseParser(segment)}
                  className="h-6 w-6 p-0 border border-green-600 text-green-700 hover:bg-green-600 hover:text-white flex-shrink-0"
                  title="Extraer/guardar versos"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Expand/Collapse Button (Only for Events in simple mode) */}
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

      {/* Unified Details Section */}
      {/* CRITICAL: Shows always for Services (alwaysExpanded=true) */}
      {/* Shows conditionally for Events based on viewMode or isExpanded */}
      {showDetails && (
        <div className="space-y-3 mt-3">
          {/* Prep Actions (Before-Start Tasks) */}
          {prepActions.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-bold text-gray-700 text-sm mb-2">⚠ PREPARACIÓN</p>
              <div className="space-y-1">
                {prepActions.map((action, idx) => (
                  <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                    {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                    {action.offset_min !== undefined && (
                      <span className="italic ml-1">({action.offset_min}m antes)</span>
                    )}
                    {action.notes && <span className="ml-1">— {action.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* During Actions (In-Segment Cues) */}
          {duringActions.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-bold text-gray-700 text-sm mb-2">▶ DURANTE SEGMENTO</p>
              <div className="space-y-1">
                {duringActions.map((action, idx) => (
                  <div key={idx} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600">
                    {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                    {action.notes && <span className="ml-1">— {action.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Notes (Operational Instructions) */}
          {/* These are critical for staff execution, always shown when details are visible */}
          <div className="grid md:grid-cols-2 gap-2">
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

          {/* Additional Details (Songs, Message Title, Artes, Description) */}
          <div className="space-y-2">
            {/* Songs List (for worship segments) */}
            {songs.length > 0 && (
              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                <p className="font-semibold text-slate-700 mb-1">Canciones:</p>
                <div className="space-y-1">
                  {songs.map((song, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span>{idx + 1}. {song.title}</span>
                      {song.lead && <span className="text-gray-600">({song.lead})</span>}
                      {song.key && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-gray-300 text-gray-500 bg-gray-50">
                          {song.key}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Title (for message segments) */}
            {getData('messageTitle') && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800">Mensaje: {getData('messageTitle')}</p>
                {(getData('scripture_references') || getData('verse')) && (
                  <p className="mt-1">Escrituras: {getData('scripture_references') || getData('verse')}</p>
                )}
              </div>
            )}

            {/* Artes (Dance/Drama/Video/Other) */}
            {(() => {
              const isArts = (segment.segment_type || '').toString() === 'Artes';
              const arts = getData('art_types') || segment.art_types;
              if (!isArts || !Array.isArray(arts) || arts.length === 0) return null;
              const hasDrama = arts.includes('DRAMA');
              const hasDance = arts.includes('DANCE');
              const hasOther = arts.includes('OTHER');
              return (
                <div className="bg-pink-50 p-2 rounded border border-pink-200 text-xs">
                  <p className="font-semibold text-pink-800 mb-1">
                    Artes: {arts.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ')}
                  </p>
                  {hasDrama && (
                    <div className="pl-2 border-l-2 border-pink-300 space-y-0.5">
                      {getData('drama_handheld_mics') > 0 && <div>Mics mano: {getData('drama_handheld_mics')}</div>}
                      {getData('drama_headset_mics') > 0 && <div>Mics diadema: {getData('drama_headset_mics')}</div>}
                      {getData('drama_start_cue') && <div>Inicio: {getData('drama_start_cue')}</div>}
                      {getData('drama_end_cue') && <div>Cierre: {getData('drama_end_cue')}</div>}
                      {getData('drama_has_song') && getData('drama_song_title') && (
                        <div>Canción: {getData('drama_song_title')}</div>
                      )}
                    </div>
                  )}
                  {hasDance && (
                    <div className="pl-2 border-l-2 border-pink-300 space-y-0.5 mt-1">
                      {getData('dance_has_song') && getData('dance_song_title') && (
                        <div>Música: {getData('dance_song_title')}</div>
                      )}
                      {getData('dance_handheld_mics') > 0 && <div>Mics mano: {getData('dance_handheld_mics')}</div>}
                      {getData('dance_headset_mics') > 0 && <div>Mics diadema: {getData('dance_headset_mics')}</div>}
                    </div>
                  )}
                  {hasOther && getData('art_other_description') && (
                    <div className="mt-1 text-gray-700">{getData('art_other_description')}</div>
                  )}
                </div>
              );
            })()}

            {/* General Description/Details */}
            {(getData('description_details') || getData('description')) && (
              <div className="bg-gray-100 border-l-4 border-gray-500 p-2 mt-2 rounded-r">
                <p className="text-xs text-gray-900 font-medium">
                  <strong>📝 Notas:</strong> {getData('description_details') || getData('description')}
                </p>
              </div>
            )}

            {/* Sub-asignaciones (custom service sub-segments) */}
            {segment.sub_asignaciones && segment.sub_asignaciones.length > 0 && (
              <div className="mt-3 space-y-2">
                {segment.sub_asignaciones.map((subSeg, idx) => (
                  <div 
                    key={subSeg._uiId || idx} 
                    className="bg-purple-50 border-l-4 border-purple-500 rounded-r pl-3 py-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-purple-600 fill-purple-100" />
                      <span className="font-bold text-purple-900 text-sm">{subSeg.title}</span>
                      {subSeg.duration && (
                        <span className="text-xs text-purple-700">({subSeg.duration} min)</span>
                      )}
                    </div>
                    {subSeg.presenter && (
                      <div className="flex items-center gap-2 text-purple-700 text-xs ml-6">
                        <Users className="w-3 h-3" />
                        <span>{normalizeName(subSeg.presenter)}</span>
                      </div>
                    )}
                    {subSeg.description && (
                      <p className="text-xs text-purple-800 ml-6 mt-1">{subSeg.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}