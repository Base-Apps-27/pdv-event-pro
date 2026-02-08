import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Languages, Mic, Users, MapPin, BookOpen, ExternalLink, Monitor, AlertTriangle } from "lucide-react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";
import { getSegmentData, getNormalizedSongs } from "@/components/utils/segmentDataUtils";
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
  assetLookup
}) {
  // Language (for type label mapping)
  const { language, t } = useLanguage();
  const [showResourcesModal, setShowResourcesModal] = useState(false);

  // Check if segment has any resource links
  const hasResourceLinks = segment.video_url || 
    segment.drama_song_source || segment.drama_song_2_url || segment.drama_song_3_url ||
    segment.dance_song_source || segment.dance_song_2_url || segment.dance_song_3_url ||
    segment.arts_run_of_show_url;
  // Helper to safely get segment data (checks data object first, then root)
  const getData = (field) => getSegmentData(segment, field);
  
  const presentationUrl = getData('presentation_url');
  const isSlidesOnly = getData('content_is_slides_only');
  
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
  const getContainerStyles = () => {
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
      className={`p-3 sm:p-4 transition-all duration-300 scroll-mt-24 ${getContainerStyles()}`}
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
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Time Display */}
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-pdv-teal flex-shrink-0" />
            <div className="flex items-baseline flex-wrap gap-x-2">
              <span className="font-bold text-base sm:text-lg text-gray-900">
                {getData('start_time') ? formatTimeToEST(getData('start_time')) : "-"}
              </span>
              {getData('end_time') && (
                <span className="text-gray-600 text-sm">- {formatTimeToEST(getData('end_time'))}</span>
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
           {/* Weekly services store these in segment.sub_assignments with person value in segment.data */}
           {segment.sub_assignments && segment.sub_assignments.length > 0 && segment.sub_assignments.map((subAssign, idx) => {
             const personValue = getData(subAssign.person_field_name);
             if (!personValue) return null;
             return (
               <div key={idx} className="flex items-center gap-2 text-purple-600 text-sm">
                 <Sparkles className="w-4 h-4" />
                 <span className="font-semibold">{subAssign.label}: {normalizeName(personValue)}</span>
                 {subAssign.duration_min && <span className="text-purple-500 text-xs">({subAssign.duration_min} min)</span>}
               </div>
             );
           })}
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

            {/* Scripture References (for Message or Offering segments) */}
            {/* Live view is READ-ONLY: Only show BookOpen when parsed_verse_data already exists */}
            {(isMessage || isOffering) && getData('parsed_verse_data') && onOpenVerses && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenVerses({
                  parsedData: getData('parsed_verse_data'),
                  rawText: getData('scripture_references') || getData('verse')
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

            {/* Message Title (for message segments) */}
            {/* Weekly services store message title in data.title, Events use message_title */}
            {/* Scriptures are accessed via the "Ver Versículos" button, not displayed inline */}
            {(getData('message_title') || (isMessage && segment.data?.title)) && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800">{t('live.message')}: {getData('message_title') || segment.data?.title}</p>
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
                    Artes: {arts.map(a => a === 'DANCE' ? 'Danza' : a === 'DRAMA' ? 'Drama' : a === 'VIDEO' ? 'Video' : 'Otro').join(', ')}
                  </p>
                  {hasDrama && (
                    <div className="pl-2 border-l-2 border-pink-300 space-y-0.5">
                      {getData('drama_handheld_mics') > 0 && <div>{t('arts.mics.handheld')}: {getData('drama_handheld_mics')}</div>}
                      {getData('drama_headset_mics') > 0 && <div>{t('arts.mics.headset')}: {getData('drama_headset_mics')}</div>}
                      {getData('drama_start_cue') && <div>{t('arts.cues.start')}: {getData('drama_start_cue')}</div>}
                      {getData('drama_end_cue') && <div>{t('arts.cues.end')}: {getData('drama_end_cue')}</div>}
                      {getData('drama_has_song') && getData('drama_song_title') && (
                        <div>{t('arts.song')}: {getData('drama_song_title')}{getData('drama_song_owner') ? ` (${getData('drama_song_owner')})` : ''}</div>
                      )}
                      {getData('drama_song_2_title') && (
                        <div>{t('arts.song')} 2: {getData('drama_song_2_title')}{getData('drama_song_2_owner') ? ` (${getData('drama_song_2_owner')})` : ''}</div>
                      )}
                      {getData('drama_song_3_title') && (
                        <div>{t('arts.song')} 3: {getData('drama_song_3_title')}{getData('drama_song_3_owner') ? ` (${getData('drama_song_3_owner')})` : ''}</div>
                      )}
                    </div>
                  )}
                  {hasDance && (
                    <div className="pl-2 border-l-2 border-pink-300 space-y-0.5 mt-1">
                      {getData('dance_handheld_mics') > 0 && <div>{t('arts.mics.handheld')}: {getData('dance_handheld_mics')}</div>}
                      {getData('dance_headset_mics') > 0 && <div>{t('arts.mics.headset')}: {getData('dance_headset_mics')}</div>}
                      {getData('dance_start_cue') && <div>{t('arts.cues.start')}: {getData('dance_start_cue')}</div>}
                      {getData('dance_end_cue') && <div>{t('arts.cues.end')}: {getData('dance_end_cue')}</div>}
                      {getData('dance_has_song') && getData('dance_song_title') && (
                        <div>{t('arts.music')}: {getData('dance_song_title')}{getData('dance_song_owner') ? ` (${getData('dance_song_owner')})` : ''}</div>
                      )}
                      {getData('dance_song_2_title') && (
                        <div>{t('arts.music')} 2: {getData('dance_song_2_title')}{getData('dance_song_2_owner') ? ` (${getData('dance_song_2_owner')})` : ''}</div>
                      )}
                      {getData('dance_song_3_title') && (
                        <div>{t('arts.music')} 3: {getData('dance_song_3_title')}{getData('dance_song_3_owner') ? ` (${getData('dance_song_3_owner')})` : ''}</div>
                      )}
                    </div>
                  )}
                  {hasOther && getData('art_other_description') && (
                    <div className="mt-1 text-gray-700">{getData('art_other_description')}</div>
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
      />
    </div>
  );
}