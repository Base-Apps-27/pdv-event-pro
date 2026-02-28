import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Languages, Mic, Users, MapPin, BookOpen, ExternalLink, Monitor, AlertTriangle, Pause, SkipForward, ArrowRightLeft } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { getSegmentData, getNormalizedSongs } from "@/components/utils/segmentDataUtils";
import { getArtsSmartNotes } from "@/components/utils/artsSmartRouting";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import SegmentResourcesModal from "./SegmentResourcesModal";

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
  assetLookup,
  timelineMode = false
}) {
  // Language (for type label mapping)
  const { language, t } = useLanguage();
  const [showResourcesModal, setShowResourcesModal] = useState(false);

  // Helper to safely get segment data (checks data object first, then root)
  const getData = (field) => getSegmentData(segment, field);
  
  const presentationUrl = getData('presentation_url');
  const notesUrl = getData('notes_url');
  const isSlidesOnly = getData('content_is_slides_only');

  // 2026-02-28: Resources button visibility — show whenever the modal would contain
  // anything beyond what the slim surface summary shows (types + order + media names).
  // This includes: arts operational data (mics, cues, setup, scripts, audio),
  // speaker resources (slides, notes), video URLs, song URLs, run-of-show PDF.
  const hasArtsOperationalData = (segment.art_types?.length > 0) && (
    segment.drama_handheld_mics > 0 || segment.drama_headset_mics > 0 ||
    segment.drama_start_cue || segment.drama_end_cue ||
    segment.dance_handheld_mics > 0 || segment.dance_headset_mics > 0 ||
    segment.dance_start_cue || segment.dance_end_cue ||
    segment.spoken_word_speaker || segment.spoken_word_mic_position || segment.spoken_word_script_url || segment.spoken_word_audio_url ||
    segment.painting_needs_easel || segment.painting_needs_drop_cloth || segment.painting_needs_lighting || segment.painting_canvas_size || segment.painting_other_setup ||
    segment.drama_song_title || segment.dance_song_title ||
    segment.video_url || segment.video_name ||
    segment.arts_run_of_show_url ||
    segment.art_other_description
  );
  const hasResourceLinks = hasArtsOperationalData ||
    segment.video_url || 
    segment.drama_song_source || segment.drama_song_2_url || segment.drama_song_3_url ||
    segment.dance_song_source || segment.dance_song_2_url || segment.dance_song_3_url ||
    segment.arts_run_of_show_url ||
    presentationUrl || notesUrl;
  
  // Determine segment type and characteristics
  const segmentType = segment.segment_type || segment.type || getData('type') || 'Especial';
  const isSpecial = ['Especial', 'Special', 'special'].includes(segmentType);
  const isWorship = ['Alabanza', 'worship'].includes(segmentType);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
  const isOffering = ['Ofrenda', 'offering'].includes(segmentType);
  const isPanel = ['Panel', 'panel'].includes(segmentType);
  const isArtes = ['Artes', 'Arts'].includes(segmentType);
  // Break types: Receso (coffee/transition), Almuerzo (meal), Break (legacy - now merged into Receso)
  const isBreakSegment = ['Break', 'Receso', 'Almuerzo'].includes(segmentType);
  
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

  // Helper to calculate action time
  const calculateActionTime = (action) => {
    const segmentStart = getData('start_time');
    const segmentEnd = getData('end_time');
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
  };

  // Determine visibility of details
  const showDetails = alwaysExpanded || viewMode === "full" || isExpanded;

  // VISUAL HIERARCHY LOGIC
  // Mobile-first: start compact (p-3 my-2), scale up on sm+ (sm:p-5 sm:my-4)
  // timelineMode: MyProgram-inspired rounded cards with status-driven styling (Services Live View)
  const getContainerStyles = () => {
    // Timeline mode: MyProgram-inspired card styles with rounded-2xl, status-driven colors
    if (timelineMode) {
      // Live Director overrides first
      if (segment.live_status === 'skipped') {
        return 'bg-gray-50 border border-gray-200 rounded-2xl opacity-50 p-4 sm:p-5';
      }
      if (segment.live_hold_status === 'held') {
        return 'bg-amber-50 border-2 border-amber-500 rounded-2xl shadow-lg p-4 sm:p-5 animate-pulse';
      }
      if (segment.live_status === 'shifted') {
        return 'bg-purple-50 border-2 border-purple-400 rounded-2xl shadow-sm p-4 sm:p-5';
      }
      // Status-driven (current > upcoming > type-based)
      if (isCurrent) return 'bg-yellow-50/80 border-2 border-yellow-400 rounded-2xl shadow-lg p-4 sm:p-5 relative overflow-hidden';
      if (isUpcoming) return 'bg-white border border-blue-200 border-l-4 border-l-blue-500 rounded-2xl shadow-sm p-4 sm:p-5';
      // Type-based
      if (isMessage) return 'bg-blue-50/60 border border-blue-200 rounded-2xl shadow-sm p-4 sm:p-5';
      if (isPanel) return 'bg-amber-50/60 border border-amber-200 rounded-2xl shadow-sm p-4 sm:p-5';
      if (isWorship) return 'bg-purple-50/60 border border-purple-200 rounded-2xl shadow-sm p-4 sm:p-5';
      if (isArtes) return 'bg-rose-50/60 border border-rose-200 rounded-2xl shadow-sm p-4 sm:p-5';
      if (isBreakSegment) return 'bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl opacity-80 p-4 sm:p-5';
      // Default
      return 'bg-white border border-gray-200 rounded-2xl p-4 sm:p-5';
    }

    // Original styles (Events Live View — unchanged)
    // 0. Live Director Status Overrides
    // Skipped segments are visually de-emphasized
    if (segment.live_status === 'skipped') {
      return 'bg-gray-100 border border-gray-300 rounded-xl my-2 sm:my-4 opacity-50 line-through-children p-3 sm:p-5';
    }
    // Held segments get amber emphasis
    if (segment.live_hold_status === 'held') {
      return 'bg-amber-50 border-2 border-amber-500 shadow-lg z-10 scale-[1.01] rounded-xl my-2 sm:my-4 mx-[-4px] sm:mx-[-8px] animate-pulse';
    }
    // Shifted segments get purple indicator
    if (segment.live_status === 'shifted') {
      return 'bg-purple-50 border-2 border-purple-400 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';
    }

    // 1. Critical Override: Active/Upcoming status always wins
    if (isCurrent) return 'bg-yellow-50 border-2 border-yellow-400 shadow-md z-10 scale-[1.01] rounded-xl my-2 sm:my-4 mx-[-4px] sm:mx-[-8px]';
    if (isUpcoming) return 'bg-blue-50 border-l-4 border-blue-400 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';

    // 2. Type-Based Styles - HERO BLOCKS
    if (isMessage) return 'bg-blue-50 border border-blue-200 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';
    if (isPanel) return 'bg-amber-50 border border-amber-200 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';
    if (isWorship) return 'bg-purple-50 border border-purple-200 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';
    if (isArtes) return 'bg-rose-50 border border-rose-300 rounded-xl my-2 sm:my-4 shadow-sm p-3 sm:p-5';
    
    // 3. Dividers
    if (isBreakSegment) return 'bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg my-4 sm:my-6 mx-2 sm:mx-4 opacity-80';
    
    // 4. Standard List Items (Connective Tissue)
    return 'bg-white border-b border-gray-100 hover:bg-gray-50 py-2 sm:py-3';
  };

  return (
    <div 
      id={domId}
      className={`${timelineMode ? '' : 'p-3 sm:p-4'} transition-all duration-300 scroll-mt-24 ${getContainerStyles()}`}
    >
      {/* Live Director Status Badges (Hold/Skip/Shift) */}
      {segment.live_hold_status === 'held' && (
        <div className="mb-2 flex items-center gap-2">
          <Badge className="bg-amber-600 text-white animate-pulse flex items-center gap-1">
            <Pause className="w-3 h-3" />
            {language === 'es' ? 'EN ESPERA' : 'ON HOLD'}
          </Badge>
          <span className="text-xs text-amber-700">
            {language === 'es' ? 'Director ajustando tiempo' : 'Director adjusting time'}
          </span>
        </div>
      )}
      {segment.live_status === 'skipped' && (
        <div className="mb-2">
          <Badge className="bg-gray-500 text-white flex items-center gap-1">
            <SkipForward className="w-3 h-3" />
            {language === 'es' ? 'OMITIDO' : 'SKIPPED'}
          </Badge>
        </div>
      )}
      {segment.live_status === 'shifted' && (
        <div className="mb-2">
          <Badge className="bg-purple-500 text-white flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3" />
            {language === 'es' ? 'MOVIDO' : 'SHIFTED'}
          </Badge>
        </div>
      )}

      {/* Current/Upcoming Status Badges — hidden in timelineMode (dots handle status) */}
      {!timelineMode && isCurrent && segment.live_status !== 'skipped' && (
        <div className="mb-2">
          <Badge className="bg-yellow-500 text-white animate-pulse">EN CURSO AHORA</Badge>
        </div>
      )}
      {!timelineMode && isUpcoming && segment.live_status !== 'skipped' && (
        <div className="mb-2">
          <Badge className="bg-blue-500 text-white">PRÓXIMO (15 min)</Badge>
        </div>
      )}

      {/* Main Segment Header (Always Visible) */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Time Display - Shows actual times if live-adjusted */}
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-pdv-teal flex-shrink-0" />
            <div className="flex items-baseline flex-wrap gap-x-2">
              {/* Show actual times if available, otherwise planned */}
              {segment.actual_start_time ? (
                <>
                  <span className="font-bold text-base sm:text-lg text-green-700">
                    {formatTimeToEST(segment.actual_start_time)}
                  </span>
                  {segment.actual_end_time ? (
                    <span className="text-green-600 text-sm">- {formatTimeToEST(segment.actual_end_time)}</span>
                  ) : getData('end_time') && (
                    <span className="text-gray-400 text-sm line-through">- {formatTimeToEST(getData('end_time'))}</span>
                  )}
                  {/* Show original planned time crossed out */}
                  {(segment.original_start_time || getData('start_time')) && (segment.original_start_time || getData('start_time')) !== segment.actual_start_time && (
                    <span className="text-gray-400 text-xs line-through ml-1">
                      (plan: {formatTimeToEST(segment.original_start_time || getData('start_time'))})
                    </span>
                  )}
                  </>
                  ) : (
                  <>
                  <span className="font-bold text-base sm:text-lg text-gray-900">
                    {getData('start_time') ? formatTimeToEST(getData('start_time')) : "-"}
                  </span>
                  {getData('end_time') && (
                    <span className="text-gray-600 text-sm">- {formatTimeToEST(getData('end_time'))}</span>
                  )}
                  {/* Show original planned time if time slot was adjusted globally */}
                  {segment._time_adjusted && segment.original_start_time && (
                    <span className="text-gray-400 text-xs line-through ml-1">
                      (plan: {formatTimeToEST(segment.original_start_time)})
                    </span>
                  )}
                  </>
                  )}
              {segment.duration_min && (
                <span className="text-xs sm:text-sm text-gray-600">({segment.duration_min} min)</span>
              )}
            </div>
          </div>

          {/* Segment Title and Type */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h4 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-1.5 leading-snug">
              {isSpecial && (
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-100 shrink-0" />
              )}
              {getData('title')}
            </h4>
            <Badge variant="outline" className="text-[10px] sm:text-xs text-gray-700 shrink-0">{displaySegmentType}</Badge>
             {segment.major_break && (<Badge className="bg-orange-600 text-white text-[10px] sm:text-xs shrink-0">{t('live.majorBreak')}</Badge>)}
            {segment.requires_translation && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Languages className="w-3.5 h-3.5 text-purple-600" />
                {segment.translation_mode === "InPerson" && <Mic className="w-3.5 h-3.5 text-purple-600" />}
              </div>
            )}
          </div>

          {/* Message Title - Prominent & High Up (Above Speaker) */}
          {(isMessage || segmentType === 'Plenaria') && (getData('message_title') || segment.data?.title) && (
            <div className="mt-1.5 mb-1">
              <h5 className="text-xl sm:text-2xl font-bold text-blue-900 leading-tight">
                {getData('message_title') || segment.data?.title}
              </h5>
            </div>
          )}

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
           {isWorship && (getData('leader') || getData('presenter')) && (
             <div className="flex items-center gap-2 text-green-600 text-sm">
               <Users className="w-4 h-4" />
               <span className="font-semibold">Dirige: {normalizeName(getData('leader') || getData('presenter'))}</span>
             </div>
           )}
           {/* Preacher: Show only for Message segments - BLUE color */}
           {isMessage && (getData('presenter') || getData('preacher')) && (
                          <div className="flex items-center gap-2 text-blue-600 text-sm">
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{t('live.preacher')}: {normalizeName(getData('presenter') || getData('preacher'))}</span>
                          </div>
                        )}
           {/* Translator: Show for all segments if present - PURPLE color */}
           {/* NOTE: Services store 'translator' in data object, Events store 'translator_name' at root */}
           {(() => {
             const translatorName = getData('translator_name') || getData('translator');
             const translationMode = getData('translation_mode');
             if (!translatorName) return null;

             // If translation_mode is explicitly "RemoteBooth", show booth style (still purple)
             if (translationMode === "RemoteBooth") {
               return (
                 <div className="flex items-center gap-2 text-purple-600 text-sm">
                   <Languages className="w-4 h-4" />
                   <span className="font-semibold">Trad-Cabina: {normalizeName(translatorName)}</span>
                 </div>
               );
             }

             // Default: InPerson or no mode specified - PURPLE color
             return (
               <div className="flex items-center gap-2 text-purple-600 text-sm">
                 <Mic className="w-4 h-4" />
                 <span className="font-semibold">{t('live.translator')}: {normalizeName(translatorName)}</span>
               </div>
             );
           })()}

           {/* Sub-assignments (Ministración, Cierre, etc.) - PURPLE color for consistency */}
           {/* Two data sources:
               1. segment.sub_assignments (weekly JSON shape — has person_field_name, value in segment.data)
               2. segment._resolved_sub_assignments (entity path via refreshActiveProgram — has presenter directly)
           */}
           {(() => {
             // Entity-resolved path: _resolved_sub_assignments from refreshActiveProgram
             const resolved = segment._resolved_sub_assignments;
             if (resolved && resolved.length > 0) {
               return resolved.map((sub, idx) => {
                 if (!sub.presenter) return null;
                 return (
                   <div key={`rsub-${idx}`} className="flex items-center gap-2 text-purple-600 text-sm">
                     <Sparkles className="w-4 h-4" />
                     <span className="font-semibold">{sub.label}: {normalizeName(sub.presenter)}</span>
                     {sub.duration_min && <span className="text-purple-500 text-xs">({sub.duration_min} min)</span>}
                   </div>
                 );
               });
             }
             // Weekly JSON path (or Entity ui_sub_assignments): sub_assignments with person_field_name lookup
             const subAssignments = segment.sub_assignments || segment.ui_sub_assignments;
             if (subAssignments && subAssignments.length > 0) {
               return subAssignments.map((subAssign, idx) => {
                 const personValue = getData(subAssign.person_field_name);
                 if (!personValue) return null;
                 return (
                   <div key={idx} className="flex items-center gap-2 text-purple-600 text-sm">
                     <Sparkles className="w-4 h-4" />
                     <span className="font-semibold">{subAssign.label}: {normalizeName(personValue)}</span>
                     {subAssign.duration_min && <span className="text-purple-500 text-xs">({subAssign.duration_min} min)</span>}
                   </div>
                 );
               });
             }
             return null;
           })()}
           {/* Room: Only show for Breakout segments OR non-Santuario locations */}
           {(() => {
             if (!segment.room_id) return null;
             const roomName = typeof getRoomName === 'function' ? getRoomName(segment.room_id) : '';
             const isBreakout = segmentType === 'Breakout';
             // Hide if not breakout AND room is Santuario (case-insensitive check)
             const isSantuario = roomName && /santuario/i.test(roomName);
             if (!isBreakout && isSantuario) return null;
             return (
               <div className="flex items-center gap-2 text-gray-600 text-sm">
                 <MapPin className="w-4 h-4" />
                 <span>
                   {t('live.roomAssigned')}{roomName ? `: ${roomName}` : ''}
                 </span>
               </div>
             );
           })()}
          </div>

          {/* Action Buttons Row (Scriptures, Resources) */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Presentation / Slides Button */}
            {presentationUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className={`h-7 px-2 border-2 text-xs gap-1 ${isSlidesOnly ? 'border-amber-500 text-amber-700 hover:bg-amber-50' : 'border-blue-500 text-blue-700 hover:bg-blue-50'}`}
                title="Abrir Presentación"
              >
                <a href={presentationUrl} target="_blank" rel="noopener noreferrer">
                  {isSlidesOnly ? <AlertTriangle className="w-3 h-3" /> : <Monitor className="w-4 h-4" />}
                  <span>{isSlidesOnly ? 'Solo Slides' : 'Abrir Slides'}</span>
                </a>
              </Button>
            )}

            {/* Notes Button */}
            {notesUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 px-2 border-2 border-purple-500 text-purple-700 hover:bg-purple-50 text-xs gap-1"
                title="Abrir Notas"
              >
                <a href={notesUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="w-4 h-4" />
                  <span>Notas</span>
                </a>
              </Button>
            )}

            {/* Scripture References (for Message or Offering segments) */}
            {/* Live view is READ-ONLY: Only show BookOpen when parsed_verse_data already exists */}
            {(isMessage || isOffering) && (
              (getData('parsed_verse_data') && getData('parsed_verse_data').type === 'verse_list') || 
              (getData('parsed_verse_data') && getData('parsed_verse_data').key_takeaways && getData('parsed_verse_data').key_takeaways.length > 0)
            ) && onOpenVerses && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenVerses({
                  parsedData: getData('parsed_verse_data'),
                  rawText: getData('scripture_references') || getData('verse'),
                  presentationUrl,
                  notesUrl,
                  isSlidesOnly
                })}
                className="h-7 px-2 border-2 border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white text-xs gap-1"
                title={t('live.viewVerses') || 'Ver Versos'}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t('live.viewVerses') || 'Ver Escrituras'}</span>
              </Button>
            )}

            {/* Resources Button - only show if segment has resource links */}
            {hasResourceLinks && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResourcesModal(true)}
                className="h-7 px-2 border-2 border-pink-500 text-pink-600 hover:bg-pink-500 hover:text-white text-xs gap-1"
                title={t('resources.title')}
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('resources.title')}</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* Item 6: Larger expand/collapse tap target for mobile (44px min touch) */}
        {!alwaysExpanded && (
          <button
            onClick={() => onToggleExpand(segment.id)}
            className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg hover:bg-gray-200/60 active:bg-gray-200 transition-colors shrink-0 -mr-1"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" /> : <ChevronDown className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" />}
          </button>
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
          {/* Item 3: Stacked action layout on mobile — label on top, time below */}
          {prepActions.length > 0 && (
            <div className="space-y-1.5">
              {prepActions.map((action, idx) => {
                const actionTime = calculateActionTime(action);
                return alwaysExpanded ? (
                  <div key={idx} className="bg-amber-50 border border-amber-200 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <span className="bg-amber-400 text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 leading-tight">⚠ PREP</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-amber-800 block leading-snug">
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {actionTime && (
                            <span className="text-[10px] sm:text-xs font-mono font-semibold text-amber-700 bg-amber-100 px-1 sm:px-1.5 py-0.5 rounded">@ {actionTime}</span>
                          )}
                          {action.notes && <span className="text-amber-700 text-[10px] sm:text-xs">— {action.notes}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="bg-amber-100 border border-amber-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <span className="bg-amber-500 text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 leading-tight">⚠ PREP</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-amber-900 block leading-snug">
                          {action.department && `[${action.department}] `}
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {actionTime && (
                            <span className="text-[10px] sm:text-xs font-mono font-semibold text-amber-700 bg-amber-200 px-1 sm:px-1.5 py-0.5 rounded">@ {actionTime}</span>
                          )}
                          {action.notes && <span className="text-amber-800 text-[10px] sm:text-xs">— {action.notes}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* During Actions (In-Segment Cues) */}
          {/* Services: muted style, no department labels */}
          {/* Events: highlighted style with department labels */}
          {duringActions.length > 0 && (
            <div className="space-y-1.5">
              {duringActions.map((action, idx) => {
                const actionTime = calculateActionTime(action);
                return alwaysExpanded ? (
                  <div key={idx} className="bg-blue-50 border border-blue-200 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <span className="bg-blue-500 text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 leading-tight">▶ DURANTE</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-blue-800 block leading-snug">
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {actionTime && (
                            <span className="text-[10px] sm:text-xs font-mono font-semibold text-blue-700 bg-blue-100 px-1 sm:px-1.5 py-0.5 rounded">@ {actionTime}</span>
                          )}
                          {action.notes && <span className="text-blue-700 text-[10px] sm:text-xs">— {action.notes}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="bg-blue-100 border border-blue-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <span className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 leading-tight">▶ DURANTE</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-blue-900 block leading-snug">
                          {action.department && `[${action.department}] `}
                          {String(action.label || '').replace(/^\s*\[[^\]]+\]\s*/, '')}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {actionTime && (
                            <span className="text-[10px] sm:text-xs font-mono font-semibold text-blue-700 bg-blue-200 px-1 sm:px-1.5 py-0.5 rounded">@ {actionTime}</span>
                          )}
                          {action.notes && <span className="text-blue-800 text-[10px] sm:text-xs">— {action.notes}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 2026-02-28: Smart-routed arts AUTO blocks REMOVED from Live View.
             * Rationale: Live View shows ALL departments + full arts detail in the pink card below,
             * so per-department AUTO routing just duplicates the same data 4-5 times.
             * AUTO routing remains on MyProgram (filtered by dept), HTML reports, and PDF
             * where it adds genuine value by surfacing arts data to departments that wouldn't
             * otherwise see it. See Decision: "Smart routing only on filtered views". */}
            {/* Item 4: Tighter note card padding on mobile (pl-2 py-1.5 → sm:pl-3 sm:py-2) */}
            {getData('coordinator_notes') && (
              <div className="bg-orange-50 border-l-4 border-orange-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-orange-800 block mb-0.5 sm:mb-1">{t('live.coordination')}:</span>
                <p className="text-orange-900 leading-snug">{getData('coordinator_notes')}</p>
              </div>
            )}
            {getData('projection_notes') && (
              <div className="bg-slate-100 border-l-4 border-slate-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-slate-700 block mb-0.5 sm:mb-1">{t('live.projection')}:</span>
                <p className="text-slate-800 leading-snug">{getData('projection_notes')}</p>
              </div>
            )}
            {getData('sound_notes') && (
              <div className="bg-red-50 border-l-4 border-red-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-red-800 block mb-0.5 sm:mb-1">{t('live.sound')}:</span>
                <p className="text-red-900 leading-snug">{getData('sound_notes')}</p>
              </div>
            )}
            {getData('ushers_notes') && (
              <div className="bg-green-50 border-l-4 border-green-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-green-800 block mb-0.5 sm:mb-1">{t('live.ushers')}:</span>
                <p className="text-green-900 leading-snug">{getData('ushers_notes')}</p>
              </div>
            )}
            {getData('translation_notes') && (
              <div className="bg-purple-50 border-l-4 border-purple-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-purple-800 block mb-0.5 sm:mb-1">{t('live.translation')}:</span>
                <p className="text-purple-900 leading-snug">{getData('translation_notes')}</p>
              </div>
            )}
            {getData('stage_decor_notes') && (
              <div className="bg-purple-50 border-l-4 border-purple-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-purple-800 block mb-0.5 sm:mb-1">{t('live.stageDecor')}:</span>
                <p className="text-purple-900 leading-snug">{getData('stage_decor_notes')}</p>
              </div>
            )}
            {getData('other_notes') && (
              <div className="bg-gray-50 border-l-4 border-gray-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-gray-800 block mb-0.5 sm:mb-1">{t('live.other') || 'Otro'}:</span>
                <p className="text-gray-900 leading-snug">{getData('other_notes')}</p>
              </div>
            )}
            {getData('prep_instructions') && (
              <div className="bg-amber-50 border-l-4 border-amber-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-amber-800 block mb-0.5 sm:mb-1">{t('live.prep') || 'Prep'}:</span>
                <p className="text-amber-900 leading-snug whitespace-pre-wrap">{getData('prep_instructions')}</p>
              </div>
            )}
            {getData('microphone_assignments') && (
              <div className="bg-red-50 border-l-4 border-red-500 pl-2 sm:pl-3 py-1.5 sm:py-2 text-xs rounded-r">
                <span className="font-bold text-red-800 block mb-0.5 sm:mb-1">Mics:</span>
                <p className="text-red-900 leading-snug">{getData('microphone_assignments')}</p>
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

            {/* Message Title moved to header area per user request */}

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

            {/* 2026-02-28: Arts summary — slim card showing types, order, and key media/people.
             * Full operational detail (mics, cues, setup) lives in the Resources modal.
             * Rationale: arts shouldn't dominate the full program view, but the summary must
             * contain enough info to survive if the app/modal is unavailable (print fallback). */}
            {(() => {
              const isArts = (segment.segment_type || '').toString() === 'Artes';
              const arts = getData('art_types') || segment.art_types;
              if (!isArts || !Array.isArray(arts) || arts.length === 0) return null;

              const TYPE_SHORT = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };

              // Performance order
              const savedOrder = segment.arts_type_order || [];
              const orderedTypes = savedOrder.length > 0
                ? [...savedOrder].filter(i => arts.includes(i.type)).sort((a, b) => (a.order || 0) - (b.order || 0)).map(i => i.type)
                : arts;
              // Append any types not in the saved order
              const inOrder = new Set(orderedTypes);
              const allTypes = [...orderedTypes, ...arts.filter(t => !inOrder.has(t))];

              // Collect key media items per type (song/video name + person — the "survive without modal" data)
              const mediaItems = [];
              allTypes.forEach(type => {
                // 2026-02-28: All media checks use data presence, NOT checkboxes
                // (drama_has_song, dance_has_song, spoken_word_has_music may not be set)
                if (type === 'DRAMA') {
                  if (getData('drama_song_title')) mediaItems.push({ type: 'Drama', label: getData('drama_song_title'), person: getData('drama_song_owner') });
                  if (getData('drama_song_2_title')) mediaItems.push({ type: 'Drama', label: getData('drama_song_2_title'), person: getData('drama_song_2_owner') });
                  if (getData('drama_song_3_title')) mediaItems.push({ type: 'Drama', label: getData('drama_song_3_title'), person: getData('drama_song_3_owner') });
                }
                if (type === 'DANCE') {
                  if (getData('dance_song_title')) mediaItems.push({ type: 'Danza', label: getData('dance_song_title'), person: getData('dance_song_owner') });
                  if (getData('dance_song_2_title')) mediaItems.push({ type: 'Danza', label: getData('dance_song_2_title'), person: getData('dance_song_2_owner') });
                  if (getData('dance_song_3_title')) mediaItems.push({ type: 'Danza', label: getData('dance_song_3_title'), person: getData('dance_song_3_owner') });
                }
                if (type === 'VIDEO') {
                  if (segment.video_name) mediaItems.push({ type: 'Video', label: segment.video_name, person: segment.video_owner });
                }
                if (type === 'SPOKEN_WORD') {
                  if (getData('spoken_word_speaker')) mediaItems.push({ type: 'Spoken Word', label: getData('spoken_word_description') || 'Spoken Word', person: getData('spoken_word_speaker') });
                  if (getData('spoken_word_music_title')) mediaItems.push({ type: 'Spoken Word', label: `🎵 ${getData('spoken_word_music_title')}`, person: getData('spoken_word_music_owner') });
                }
                if (type === 'OTHER' && getData('art_other_description')) {
                  mediaItems.push({ type: 'Otro', label: getData('art_other_description') });
                }
              });

              return (
                <div className="bg-pink-50 p-2 rounded border border-pink-200 text-xs">
                  {/* Types + performance order */}
                  <p className="font-semibold text-pink-800">
                    Artes: {allTypes.length > 1
                      ? allTypes.map(a => TYPE_SHORT[a] || a).join(' → ')
                      : allTypes.map(a => TYPE_SHORT[a] || a).join(', ')}
                  </p>
                  {/* Key media & people (print-safe fallback) */}
                  {mediaItems.length > 0 && (
                    <div className="mt-1 pl-2 border-l-2 border-pink-300 space-y-0.5 text-gray-700">
                      {mediaItems.map((item, i) => (
                        <div key={i}>
                          <span className="text-pink-600 font-medium">{item.type}:</span>{' '}
                          {item.label}{item.person ? ` — ${item.person}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Announcement Details (for Anuncio segments) */}
            {segmentType === 'Anuncio' && (getData('announcement_title') || getData('announcement_description')) && (
              <div className="bg-indigo-50 p-2 rounded border border-indigo-200 text-xs space-y-1">
                {getData('announcement_title') && (
                  <p className="font-semibold text-indigo-800">📢 {getData('announcement_title')}</p>
                )}
                {getData('announcement_description') && (
                  <p className="text-indigo-700 whitespace-pre-wrap">{getData('announcement_description')}</p>
                )}
                {getData('announcement_date') && (
                  <p className="text-indigo-600">{language === 'es' ? 'Fecha' : 'Date'}: {getData('announcement_date')}</p>
                )}
                {getData('announcement_tone') && (
                  <p className="text-indigo-600 italic">{language === 'es' ? 'Tono' : 'Tone'}: {getData('announcement_tone')}</p>
                )}
              </div>
            )}

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

      {/* Resources Modal */}
      <SegmentResourcesModal
        open={showResourcesModal}
        onOpenChange={setShowResourcesModal}
        segment={segment}
        onOpenVerses={onOpenVerses}
      />
    </div>
  );
}