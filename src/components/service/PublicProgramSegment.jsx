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
  onOpenVerseParser,
  getRoomName,
  slidePackLookup,
  assetLookup
}) {
  // Language (for type label mapping)
  const { language, t } = useLanguage();
  // Helper to safely get segment data (checks data object first, then root)
  const getData = (field) => getSegmentData(segment, field);
  
  // Determine segment type and characteristics
  const segmentType = segment.segment_type || segment.type || getData('type') || 'Especial';
  const isSpecial = ['Especial', 'Special', 'special'].includes(segmentType);
  const isWorship = ['Alabanza', 'worship'].includes(segmentType);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
  const isOffering = ['Ofrenda', 'offering'].includes(segmentType);
  const isPanel = ['Panel', 'panel'].includes(segmentType);
  // Break types: Receso (coffee/transition), Almuerzo (meal), Break (legacy - now merged into Receso)
  const isBreakSegment = ['Break', 'Receso', 'Almuerzo'].includes(segmentType);
  // Hide scriptures in PDFs/Reports; live view still shows via this component when provided
  
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
    const actionsBase = isSpecial 
      ? rawActions.filter(a => {
          const label = (a.label || '').toLowerCase();
          // Filter out generic worship actions from special segments (data migration artifacts)
          return !label.includes('pianista sube') && !label.includes('equipo de a&a sube');
        })
      : rawActions;
    // Hide Hospitality actions per product decision
    const actions = actionsBase.filter(a => (a?.department || '') !== 'Hospitality');

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
             {segment.major_break && (<Badge className="bg-orange-600 text-white text-xs">{t('live.majorBreak')}</Badge>)}
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
           {isMessage && (getData('presenter') || getData('preacher')) && (
                         <div className="flex items-center gap-2 text-indigo-600 text-sm">
                           <Users className="w-4 h-4" />
                           <span className="font-semibold">{t('live.preacher')}: {normalizeName(getData('presenter') || getData('preacher'))}</span>
                         </div>
                       )}
           {/* Translator: Show for all segments if present, differentiate by mode */}
           {/* NOTE: Must use getData() for translation_mode since Services nest data differently than Events */}
           {getData('translator_name') && getData('translation_mode') === "InPerson" && (
                          <div className="flex items-center gap-2 text-blue-600 text-sm">
                            <Mic className="w-4 h-4" />
                            <span className="font-semibold">{t('live.translator')} (tarima): {normalizeName(getData('translator_name'))}</span>
                          </div>
                        )}
           {getData('translator_name') && getData('translation_mode') === "RemoteBooth" && (
                          <div className="flex items-center gap-2 text-cyan-600 text-sm">
                            <Languages className="w-4 h-4" />
                            <span className="font-semibold">Trad-Cabina: {normalizeName(getData('translator_name'))}</span>
                          </div>
                        )}
           {/* Room: Show if segment has a specific room assignment */}
           {segment.room_id && (
                         <div className="flex items-center gap-2 text-gray-600 text-sm">
                           <MapPin className="w-4 h-4" />
                           <span>
                             {t('live.roomAssigned')}{(typeof getRoomName === 'function' && getRoomName(segment.room_id)) ? `: ${getRoomName(segment.room_id)}` : ''}
                           </span>
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
                  title={t('live.viewVerses')}
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
                  title={t('live.extractSaveVerses')}
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
          {/* Services (alwaysExpanded): muted style, no department labels (standard reminders) */}
          {/* Events (!alwaysExpanded): highlighted style with department labels (unique callouts) */}
          {prepActions.length > 0 && (
            <div className="space-y-1">
              {prepActions.map((action, idx) => (
                alwaysExpanded ? (
                  // Services: muted style without department prefix
                  <div key={idx} className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">⚠ PREP</span>
                      <div className="flex-1">
                        <span className="text-amber-800">
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        {action.offset_min !== undefined && (
                          <span className="text-amber-600 italic ml-1">({action.offset_min}m antes)</span>
                        )}
                        {action.notes && <span className="text-amber-700 ml-1">— {action.notes}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Events: highlighted style with department prefix
                  <div key={idx} className="bg-amber-100 border border-amber-300 rounded px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">⚠ PREP</span>
                      <div className="flex-1">
                        <span className="font-semibold text-amber-900">
                          {action.department && `[${action.department}] `}
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        {action.offset_min !== undefined && (
                          <span className="text-amber-700 italic ml-1">({action.offset_min}m antes)</span>
                        )}
                        {action.notes && <span className="text-amber-800 ml-1">— {action.notes}</span>}
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* During Actions (In-Segment Cues) */}
          {/* Services: muted style, no department labels */}
          {/* Events: highlighted style with department labels */}
          {duringActions.length > 0 && (
            <div className="space-y-1">
              {duringActions.map((action, idx) => (
                alwaysExpanded ? (
                  // Services: muted style without department prefix
                  <div key={idx} className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">▶ DURANTE</span>
                      <div className="flex-1">
                        <span className="text-blue-800">
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        {action.offset_min !== undefined && (
                          <span className="text-blue-600 italic ml-1">({action.offset_min}m)</span>
                        )}
                        {action.notes && <span className="text-blue-700 ml-1">— {action.notes}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Events: highlighted style with department prefix
                  <div key={idx} className="bg-blue-100 border border-blue-300 rounded px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">▶ DURANTE</span>
                      <div className="flex-1">
                        <span className="font-semibold text-blue-900">
                          {action.department && `[${action.department}] `}
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        {action.offset_min !== undefined && (
                          <span className="text-blue-700 italic ml-1">({action.offset_min}m)</span>
                        )}
                        {action.notes && <span className="text-blue-800 ml-1">— {action.notes}</span>}
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Break-type segments (Receso/Almuerzo) - enhanced visual distinction */}
          {isBreakSegment && (
            <div className={`rounded-lg p-3 border-2 ${segment.segment_type === 'Almuerzo' ? 'bg-orange-50 border-orange-300' : 'bg-gray-100 border-gray-300'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {segment.segment_type === 'Almuerzo' ? (
                  <>
                    <span className="text-2xl">🍽️</span>
                    <span className="text-orange-800">{segment.duration_min} min</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">☕</span>
                    <span className="text-gray-700">{segment.duration_min} min</span>
                  </>
                )}
              </div>
              {segment.presenter && (
                <div className="text-xs mt-1 text-gray-600">
                  <span className="font-medium">{language === 'es' ? 'Encargado' : 'Host'}:</span> {segment.presenter}
                </div>
              )}
            </div>
          )}

          {/* Team Notes (Operational Instructions) */}
          {/* These are critical for staff execution, always shown when details are visible */}
          <div className="grid md:grid-cols-2 gap-2">
            {getData('coordinator_notes') && (
              <div className="bg-orange-50 border-l-4 border-orange-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-orange-800 block mb-1">{t('live.coordination')}:</span>
                <p className="text-orange-900 leading-snug">{getData('coordinator_notes')}</p>
              </div>
            )}
            {/* Projection notes - slate color (distinct from purple/translation) */}
            {getData('projection_notes') && (
              <div className="bg-slate-100 border-l-4 border-slate-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-slate-700 block mb-1">{t('live.projection')}:</span>
                <p className="text-slate-800 leading-snug">{getData('projection_notes')}</p>
              </div>
            )}
            {getData('sound_notes') && (
              <div className="bg-red-50 border-l-4 border-red-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-red-800 block mb-1">{t('live.sound')}:</span>
                <p className="text-red-900 leading-snug">{getData('sound_notes')}</p>
              </div>
            )}
            {getData('ushers_notes') && (
              <div className="bg-green-50 border-l-4 border-green-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-green-800 block mb-1">{t('live.ushers')}:</span>
                <p className="text-green-900 leading-snug">{getData('ushers_notes')}</p>
              </div>
            )}
            {getData('translation_notes') && (
              <div className="bg-purple-50 border-l-4 border-purple-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-purple-800 block mb-1">{t('live.translation')}:</span>
                <p className="text-purple-900 leading-snug">{getData('translation_notes')}</p>
              </div>
            )}
            {/* Stage & Decor notes - purple color (same as translation) */}
            {getData('stage_decor_notes') && (
              <div className="bg-purple-50 border-l-4 border-purple-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-purple-800 block mb-1">{t('live.stageDecor')}:</span>
                <p className="text-purple-900 leading-snug">{getData('stage_decor_notes')}</p>
              </div>
            )}
            {getData('microphone_assignments') && (
              <div className="bg-red-50 border-l-4 border-red-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-red-800 block mb-1">Mics:</span>
                <p className="text-red-900 leading-snug">{getData('microphone_assignments')}</p>
              </div>
            )}
            {getData('other_notes') && (
              <div className="bg-gray-50 border-l-4 border-gray-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-gray-800 block mb-1">{t('live.other') || 'Otro'}:</span>
                <p className="text-gray-900 leading-snug">{getData('other_notes')}</p>
              </div>
            )}
            {getData('prep_instructions') && (
              <div className="bg-amber-50 border-l-4 border-amber-500 pl-3 py-2 text-xs rounded-r">
                <span className="font-bold text-amber-800 block mb-1">Prep:</span>
                <p className="text-amber-900 leading-snug">{getData('prep_instructions')}</p>
              </div>
            )}
          </div>

          {/* Additional Details (Songs, Message Title, Artes, Description) */}
          <div className="space-y-2">
            {/* Songs List (for worship segments) */}
            {songs.length > 0 && (
              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                <p className="font-semibold text-slate-700 mb-1">{t('live.songs')}:</p>
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
            {getData('message_title') && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800">{t('live.message')}: {getData('message_title')}</p>
                {(getData('scripture_references') || getData('verse')) && (
                  <p className="mt-1">{t('live.scriptures')}: {getData('scripture_references') || getData('verse')}</p>
                )}
              </div>
            )}

            {/* Video (if attached) */}
            {segment.has_video && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800">{t('live.video')}:</p>
                <div className="text-gray-700">
                  {segment.video_name && <span>{segment.video_name}</span>}
                  {segment.video_location && <span className="ml-1 text-gray-600">({segment.video_location})</span>}
                  {typeof segment.video_length_sec === 'number' && (
                    <span className="ml-1 text-gray-600">- {Math.floor(segment.video_length_sec / 60)}:{String(segment.video_length_sec % 60).padStart(2, '0')}</span>
                  )}
                  {segment.video_owner && <span className="ml-1 text-gray-600">• {segment.video_owner}</span>}
                </div>
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
                      {getData('drama_handheld_mics') > 0 && <div>{t('arts.mics.handheld')}: {getData('drama_handheld_mics')}</div>}
                      {getData('drama_headset_mics') > 0 && <div>{t('arts.mics.headset')}: {getData('drama_headset_mics')}</div>}
                      {getData('drama_start_cue') && <div>{t('arts.cues.start')}: {getData('drama_start_cue')}</div>}
                      {getData('drama_end_cue') && <div>{t('arts.cues.end')}: {getData('drama_end_cue')}</div>}
                      {getData('drama_has_song') && getData('drama_song_title') && (
                        <div>{t('arts.song')}: {getData('drama_song_title')}</div>
                      )}
                    </div>
                  )}
                  {hasDance && (
                    <div className="pl-2 border-l-2 border-pink-300 space-y-0.5 mt-1">
                      {getData('dance_has_song') && getData('dance_song_title') && (
                        <div>{t('arts.music')}: {getData('dance_song_title')}</div>
                      )}
                      {getData('dance_handheld_mics') > 0 && <div>{t('arts.mics.handheld')}: {getData('dance_handheld_mics')}</div>}
                      {getData('dance_headset_mics') > 0 && <div>{t('arts.mics.headset')}: {getData('dance_headset_mics')}</div>}
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
                  <strong>📝 {t('live.notes')}:</strong> {getData('description_details') || getData('description')}
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

            {/* Assets (Slides / Countdown) */}
            {(segment.slide_pack_id || segment.countdown_asset_id) && (
              <div className="flex gap-2 flex-wrap text-[11px]">
                {segment.slide_pack_id && (
                  <Badge variant="outline" className="border-gray-300 bg-white text-gray-700">
                    {t('live.slides')}: {(slidePackLookup && slidePackLookup[segment.slide_pack_id]) || segment.slide_pack_id}
                  </Badge>
                )}
                {segment.countdown_asset_id && (
                  <Badge variant="outline" className="border-gray-300 bg-white text-gray-700">
                    {t('live.countdown')}: {(assetLookup && assetLookup[segment.countdown_asset_id]) || segment.countdown_asset_id}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}