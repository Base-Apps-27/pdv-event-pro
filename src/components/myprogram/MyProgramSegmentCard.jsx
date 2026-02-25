import React from 'react';
import { Clock, Users, Sparkles, Languages, Mic, BookOpen, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTimeToEST } from '@/components/utils/timeFormat';
import { useLanguage } from '@/components/utils/i18n';
import { getSegmentData, getNormalizedSongs } from '@/components/utils/segmentDataUtils';
import { normalizeName } from '@/components/utils/textNormalization';
import DepartmentNotes from './DepartmentNotes';


function getSegmentTiming(segment, currentTime) {
  if (!currentTime || !segment.start_time) return { start: 0, end: 0, now: 0 };
  
  const now = currentTime.getHours() * 60 + currentTime.getMinutes();
  const [startH, startM] = segment.start_time.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  
  let endMinutes = startMinutes + (segment.duration_min || 0);
  if (segment.end_time) {
    const [endH, endM] = segment.end_time.split(':').map(Number);
    endMinutes = endH * 60 + endM;
  }
  
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  
  return { start: startMinutes, end: endMinutes, now };
}

function getCountdown(segment, currentTime, status, t) {
  const { start, end, now } = getSegmentTiming(segment, currentTime);
  if (!start) return null;

  if (status === 'now') {
    const remaining = end - now;
    if (remaining <= 0) return t('myprogram.eventEnded');
    return `${t('myprogram.countdown.endsIn')} ${remaining} min`;
  }

  return null;
}

// Map department IDs to internal labels for filtering actions
const DEPT_LABEL_MAP = {
  general: 'All',
  projection: 'Projection',
  sound: 'Sound',
  ushers: 'Ushers', // Covers Ujieres
  translation: 'Translation',
  stage_decor: 'Stage & Decor',
  hospitality: 'Hospitality',
  coordination: 'Coordinador', // Coordinator
  livestream: 'Livestream',
};

export default function MyProgramSegmentCard({ segment, status, department, currentTime, onOpenVerses }) {
  const { t, language } = useLanguage();
  const getData = (field) => getSegmentData(segment, field);

  const segmentType = segment.segment_type || segment.type || 'Especial';
  const isWorship = ['Alabanza', 'worship'].includes(segmentType);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
  const isBreak = ['Break', 'Receso', 'Almuerzo'].includes(segmentType);
  const isSpecial = ['Especial', 'Special'].includes(segmentType);

  const songs = isWorship ? getNormalizedSongs(segment).filter(s => s.title) : [];
  const countdown = getCountdown(segment, currentTime, status, t);

  // Calculate Progress if active
  let progressPercent = 0;
  if (status === 'now') {
    const { start, end, now } = getSegmentTiming(segment, currentTime);
    if (end > start) {
      const total = end - start;
      const elapsed = now - start;
      progressPercent = Math.min(100, Math.max(0, (elapsed / total) * 100));
    }
  }

  // Filter Actions based on department
  // General view: no actions (only pre-service notes + segment notes shown)
  const rawActions = segment.segment_actions || segment.actions || getData('actions') || [];
  const deptActions = department === 'general' ? [] : rawActions.filter(action => {
    const target = DEPT_LABEL_MAP[department];
    return action.department === target || action.department === 'All' || !action.department;
  });

  // Container styles by status
  const containerClass = {
    done: 'bg-gray-50 border-gray-200 opacity-60 grayscale',
    now: 'bg-yellow-50/80 border-yellow-400 border-2 shadow-lg scale-[1.02]',
    next: 'bg-white border-blue-200 border-l-4 border-l-blue-500 shadow-sm',
    upcoming: 'bg-white border-gray-200',
  }[status] || 'bg-white border-gray-200';

  // Type badge colors
  const typeBadgeClass = isMessage ? 'bg-blue-100 text-blue-800'
    : isWorship ? 'bg-purple-100 text-purple-800'
    : isBreak ? 'bg-gray-200 text-gray-600'
    : 'bg-gray-100 text-gray-700';

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${containerClass}`}>
      {/* Progress Bar (Active Only) */}
      {status === 'now' && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 rounded-t-2xl overflow-hidden">
          <div 
            className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Header: Countdown / Status */}
      <div className="flex justify-between items-start mb-3 relative">
        <div className="flex items-center gap-2.5">
          {status === 'now' && (
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 text-xs px-2.5 py-0.5 animate-pulse shadow-sm">
              {t('myprogram.now')}
            </Badge>
          )}
          {status === 'next' && (
            <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-xs px-2.5 py-0.5 shadow-sm">
              {t('myprogram.next')}
            </Badge>
          )}
          <span className={`font-mono text-base font-bold ${status === 'done' ? 'text-gray-400' : 'text-gray-900'}`}>
            {getData('start_time') ? formatTimeToEST(getData('start_time')) : '-'}
          </span>
        </div>
        
        {countdown && (
          <div className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
            status === 'now' ? 'bg-yellow-200 text-yellow-900' : 'bg-blue-100 text-blue-800'
          }`}>
            {countdown}
          </div>
        )}
      </div>

      {/* Title + Type */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {isSpecial && <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100 shrink-0" />}
          <h4 className={`text-lg font-extrabold leading-snug ${status === 'done' ? 'text-gray-500' : 'text-gray-900'}`}>
            {getData('title')}
          </h4>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className={`text-xs px-2 py-0.5 font-medium ${typeBadgeClass}`}>
            {segmentType}
          </Badge>
          {segment.requires_translation && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-purple-200 text-purple-700 bg-purple-50 gap-1">
              <Languages className="w-3.5 h-3.5" />
              <span>Trad</span>
            </Badge>
          )}
          {segment.duration_min > 0 && (
            <span className="text-xs text-gray-400 font-medium self-center">
              {segment.duration_min} min
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className={`space-y-3 ${status === 'done' ? 'opacity-80' : ''}`}>
        {/* Message title — resolve from message_title, messageTitle, or data.title */}
        {isMessage && (getData('message_title') || getData('messageTitle')) && (
          <p className="text-sm font-bold text-blue-800 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
            {getData('message_title') || getData('messageTitle')}
          </p>
        )}

        {/* Presenter / Leader / Translator (Visible to ALL departments) */}
        <div className="grid grid-cols-1 gap-1.5">
          {/* Preacher for message segments: check preacher first, then presenter */}
          {isMessage && (getData('preacher') || getData('presenter')) && (
            <div className="flex items-center gap-2.5 text-sm text-blue-700 font-medium">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>{t('live.preacher')}: {normalizeName(getData('preacher') || getData('presenter'))}</span>
            </div>
          )}
          {isWorship && (getData('leader') || getData('presenter')) && (
            <div className="flex items-center gap-2.5 text-sm text-green-700 font-medium">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>{normalizeName(getData('leader') || getData('presenter'))}</span>
            </div>
          )}
          {!isWorship && !isMessage && getData('presenter') && (
            <div className="flex items-center gap-2.5 text-sm text-blue-600 font-medium">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>{normalizeName(getData('presenter'))}</span>
            </div>
          )}
          {/* Sub-assignments (e.g. Ministración, Cierre) — purple to match PublicProgramSegment */}
          {(segment.sub_assignments || segment.ui_sub_assignments || []).map((sa, idx) => {
            const person = sa._resolvedPerson || getData(sa.person_field_name);
            if (!sa.label || !person) return null;
            return (
              <div key={`sa-${idx}`} className="flex items-center gap-2.5 text-sm text-purple-600 font-medium">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>{sa.label}: {normalizeName(person)}</span>
                {sa.duration_min > 0 && (
                  <span className="text-purple-500 text-[10px]">({sa.duration_min} min)</span>
                )}
              </div>
            );
          })}
          {/* Translator: InPerson (All) OR Remote (Translation Dept only) */}
          {(() => {
            const transName = getData('translator_name') || getData('translator');
            const transMode = getData('translation_mode');
            if (!transName) return null;

            const isStage = transMode === 'InPerson';
            const isTargetDept = ['translation', 'coordination', 'general'].includes(department);
            
            // Show if: From Stage (Everyone) OR Target Dept (sees all)
            if (isStage || isTargetDept) {
              return (
                <div className="flex items-center gap-2.5 text-sm text-purple-700 font-medium">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    {t('live.translator')}: {normalizeName(transName)} 
                    {!isStage && <span className="text-purple-500 text-[10px] ml-1 uppercase border border-purple-200 px-1 rounded bg-white">Booth</span>}
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Songs (general department, worship segments) */}
        {department === 'general' && songs.length > 0 && (
          <div className="bg-gray-50/80 rounded-lg p-2.5 text-xs text-gray-700 border border-gray-100">
            {songs.map((s, i) => (
              <div key={i} className="flex gap-2 mb-1 last:mb-0">
                <span className="text-gray-400 font-mono w-3">{i + 1}.</span>
                <span className="font-medium text-gray-800">{s.title}</span>
                {s.lead && <span className="text-gray-500">({s.lead})</span>}
                {s.key && <span className="text-gray-400 font-mono ml-auto text-[10px] bg-white px-1 rounded border border-gray-200">{s.key}</span>}
              </div>
            ))}
          </div>
        )}

        {/* View Verses / Key Points Button */}
        {getData('parsed_verse_data') && (
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 h-8"
              onClick={() => onOpenVerses({
                parsedData: getData('parsed_verse_data'),
                rawText: getData('submitted_content'),
                presentationUrl: getData('presentation_url'),
                notesUrl: getData('notes_url'),
                isSlidesOnly: getData('content_is_slides_only')
              })}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-xs">Versos y Puntos Clave</span>
            </Button>
          </div>
        )}

        {/* Department-specific notes */}
        <DepartmentNotes segment={segment} department={department} />

        {/* Segment Actions (Filtered) */}
        {deptActions.length > 0 && (
          <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
            {deptActions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-gray-700 mr-1">
                    {action.department ? `[${action.department}]` : ''}
                  </span>
                  <span>{action.label}</span>
                  {action.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{action.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Breakout Groups (Visible to ALL departments) */}
        {segment.breakout_rooms && segment.breakout_rooms.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Breakout Groups
            </p>
            {segment.breakout_rooms.map((room, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-2 border border-gray-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-800">{room.topic || 'Breakout'}</span>
                  {room._roomName && (
                    <Badge variant="outline" className="text-[9px] h-4 bg-white">
                      {room._roomName}
                    </Badge>
                  )}
                </div>
                <div className="text-gray-600 space-y-0.5">
                  {room.speakers && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span>{normalizeName(room.speakers)}</span>
                    </div>
                  )}
                  {room.hosts && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span className="italic">{normalizeName(room.hosts)} (Host)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Break visual */}
        {isBreak && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100/50 p-2 rounded-lg border border-dashed border-gray-200">
            <span className="text-base">{segment.segment_type === 'Almuerzo' ? '🍽️' : '☕'}</span>
            <span className="font-medium">{segment.duration_min} min {segment.segment_type}</span>
          </div>
        )}
      </div>

    </div>
  );
}