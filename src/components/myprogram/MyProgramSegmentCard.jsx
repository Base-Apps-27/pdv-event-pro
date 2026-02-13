/**
 * MyProgramSegmentCard — MyProgram Step 8
 * 
 * Single segment card for MyProgram timeline.
 * Compact, mobile-first, shows department-specific notes.
 * 
 * Visual states: done (gray), now (yellow pulse), next (blue), upcoming (white)
 */
import React from 'react';
import { Clock, Users, Sparkles, Languages, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatTimeToEST } from '@/components/utils/timeFormat';
import { useLanguage } from '@/components/utils/i18n';
import { getSegmentData, getNormalizedSongs } from '@/components/utils/segmentDataUtils';
import { normalizeName } from '@/components/utils/textNormalization';
import DepartmentNotes from './DepartmentNotes';

export default function MyProgramSegmentCard({ segment, status, department }) {
  const { t, language } = useLanguage();
  const getData = (field) => getSegmentData(segment, field);

  const isWorship = ['Alabanza', 'worship'].includes(segment.segment_type);
  const isMessage = ['Plenaria', 'message', 'Message'].includes(segment.segment_type);
  const isBreak = ['Break', 'Receso', 'Almuerzo'].includes(segment.segment_type);
  const isSpecial = ['Especial', 'Special'].includes(segment.segment_type);

  const songs = isWorship ? getNormalizedSongs(segment).filter(s => s.title) : [];

  // Container styles by status
  const containerClass = {
    done: 'bg-gray-50 border-gray-200 opacity-60',
    now: 'bg-yellow-50 border-yellow-400 border-2 shadow-md',
    next: 'bg-blue-50 border-blue-300 border-2',
    upcoming: 'bg-white border-gray-100',
  }[status] || 'bg-white border-gray-100';

  // Type badge colors
  const typeBadgeClass = isMessage ? 'bg-blue-100 text-blue-800'
    : isWorship ? 'bg-purple-100 text-purple-800'
    : isBreak ? 'bg-gray-200 text-gray-600'
    : 'bg-gray-100 text-gray-700';

  return (
    <div className={`rounded-xl border p-3 transition-all ${containerClass}`}>
      {/* Status pill */}
      {status === 'now' && (
        <Badge className="bg-yellow-500 text-white text-[10px] mb-1.5 animate-pulse">{t('myprogram.now')}</Badge>
      )}
      {status === 'next' && (
        <Badge className="bg-blue-500 text-white text-[10px] mb-1.5">{t('myprogram.next')}</Badge>
      )}

      {/* Time + Duration row */}
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className={`font-mono text-sm font-bold ${status === 'done' ? 'text-gray-400' : 'text-gray-900'}`}>
          {getData('start_time') ? formatTimeToEST(getData('start_time')) : '-'}
        </span>
        {getData('end_time') && (
          <span className="text-gray-400 text-xs">- {formatTimeToEST(getData('end_time'))}</span>
        )}
        {segment.duration_min > 0 && (
          <span className="text-gray-400 text-[10px]">({segment.duration_min}m)</span>
        )}
      </div>

      {/* Title + Type */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {isSpecial && <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
        <h4 className={`text-sm font-bold leading-snug ${status === 'done' ? 'text-gray-400' : 'text-gray-900'}`}>
          {getData('title')}
        </h4>
        <Badge className={`text-[9px] px-1.5 py-0 ${typeBadgeClass}`}>
          {segment.segment_type}
        </Badge>
        {segment.requires_translation && (
          <Languages className="w-3 h-3 text-purple-500 shrink-0" />
        )}
      </div>

      {/* Message title */}
      {isMessage && getData('message_title') && (
        <p className="text-sm font-bold text-blue-800 mb-1">{getData('message_title')}</p>
      )}

      {/* Presenter / Leader / Translator (always shown in general) */}
      {department === 'general' && (
        <div className="space-y-0.5">
          {isMessage && getData('presenter') && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <Users className="w-3 h-3" />
              <span className="font-semibold">{t('live.preacher')}: {normalizeName(getData('presenter'))}</span>
            </div>
          )}
          {isWorship && (getData('leader') || getData('presenter')) && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <Users className="w-3 h-3" />
              <span className="font-semibold">{normalizeName(getData('leader') || getData('presenter'))}</span>
            </div>
          )}
          {!isWorship && !isMessage && getData('presenter') && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Users className="w-3 h-3" />
              <span>{normalizeName(getData('presenter'))}</span>
            </div>
          )}
          {(getData('translator_name') || getData('translator')) && (
            <div className="flex items-center gap-1.5 text-xs text-purple-600">
              <Mic className="w-3 h-3" />
              <span>{t('live.translator')}: {normalizeName(getData('translator_name') || getData('translator'))}</span>
            </div>
          )}
        </div>
      )}

      {/* Songs (general department, worship segments) */}
      {department === 'general' && songs.length > 0 && (
        <div className="mt-1.5 bg-slate-50 rounded p-1.5 text-[11px] text-gray-700">
          {songs.map((s, i) => (
            <div key={i} className="flex gap-1">
              <span className="text-gray-400">{i + 1}.</span>
              <span>{s.title}</span>
              {s.lead && <span className="text-gray-400">({s.lead})</span>}
              {s.key && <span className="text-gray-400 font-mono">{s.key}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Department-specific notes */}
      <DepartmentNotes segment={segment} department={department} />

      {/* Break visual */}
      {isBreak && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
          <span>{segment.segment_type === 'Almuerzo' ? '🍽️' : '☕'}</span>
          <span>{segment.duration_min}m</span>
        </div>
      )}
    </div>
  );
}