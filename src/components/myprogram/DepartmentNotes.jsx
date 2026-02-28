/**
 * DepartmentNotes — MyProgram Step 6 (Refined)
 * 
 * Renders department-specific notes from segment fields.
 * Updates:
 * - Projection notes: High contrast (Indigo/Blue) per user feedback ("too grey")
 * - Hospitality: Maps to 'ushers_notes' as fallback if needed, but actions are primary.
 */
import React from 'react';
import { useLanguage } from '@/components/utils/i18n';
import { getSegmentData } from '@/components/utils/segmentDataUtils';
import { getArtsSmartNotes } from '@/components/utils/artsSmartRouting';

// Maps department key → segment field(s) to display
const DEPT_FIELD_MAP = {
  projection: ['projection_notes'],
  sound: ['sound_notes', 'microphone_assignments'],
  ushers: ['ushers_notes'],
  translation: ['translation_notes'],
  stage_decor: ['stage_decor_notes'],
  hospitality: ['ushers_notes'], // Often shared, or rely on actions
  coordination: ['coordinator_notes', 'prep_instructions', 'other_notes'],
  livestream: ['livestream_notes', 'projection_notes'],
};

// Updated Colors - Projection is now distinct (Indigo)
const DEPT_COLORS = {
  projection: { bg: 'bg-indigo-50', border: 'border-indigo-500', text: 'text-indigo-900', label: 'text-indigo-700' },
  sound: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-900', label: 'text-red-700' },
  ushers: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-900', label: 'text-green-700' },
  translation: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', label: 'text-purple-700' },
  stage_decor: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', text: 'text-fuchsia-900', label: 'text-fuchsia-700' },
  hospitality: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', label: 'text-amber-700' },
  coordination: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', label: 'text-orange-700' },
  livestream: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', label: 'text-blue-700' },
};

const FIELD_LABELS = {
  projection_notes: { es: 'Proyección', en: 'Projection' },
  sound_notes: { es: 'Sonido', en: 'Sound' },
  microphone_assignments: { es: 'Micrófonos', en: 'Microphones' },
  ushers_notes: { es: 'Ujieres', en: 'Ushers' },
  translation_notes: { es: 'Traducción', en: 'Translation' },
  stage_decor_notes: { es: 'Stage & Decor', en: 'Stage & Decor' },
  coordinator_notes: { es: 'Coordinación', en: 'Coordination' },
  prep_instructions: { es: 'Preparación', en: 'Preparation' },
  other_notes: { es: 'Notas', en: 'Notes' },
  livestream_notes: { es: 'Livestream', en: 'Livestream' },
};

export default function DepartmentNotes({ segment, department }) {
  const { language, t } = useLanguage();
  const getData = (field) => getSegmentData(segment, field);

  // General department: show only description_details (segment notes)
  // Department-specific views show their targeted notes
  if (department === 'general') {
    const desc = getData('description_details');
    if (!desc) return null;
    return (
      <div className="space-y-2 mt-2">
        <div className="bg-gray-50 border-l-[4px] border-gray-400 pl-3 py-2 rounded-r-md text-xs shadow-sm">
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">{desc}</p>
        </div>
      </div>
    );
  }

  const fields = DEPT_FIELD_MAP[department] || [];
  const colors = DEPT_COLORS[department] || DEPT_COLORS.coordination;

  const notesContent = fields
    .map((field) => ({ field, value: getData(field) }))
    .filter((item) => item.value);

  // 2026-02-28: Smart-routed arts data for this department (computed, no double-entry)
  const artsItems = getArtsSmartNotes(segment, department, language);

  if (notesContent.length === 0 && artsItems.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Manual department notes */}
      {notesContent.map(({ field, value }) => (
        <div
          key={field}
          className={`${colors.bg} border-l-[4px] ${colors.border} pl-3 py-2 rounded-r-md text-xs shadow-sm`}
        >
          <span className={`font-bold ${colors.label} block mb-1 uppercase tracking-wider text-[10px]`}>
            {FIELD_LABELS[field]?.[language] || field}
          </span>
          <p className={`${colors.text} leading-relaxed whitespace-pre-wrap font-medium`}>{value}</p>
        </div>
      ))}
      {/* 2026-02-28: Auto-routed arts data — visually distinct with dashed border + AUTO badge */}
      {artsItems.length > 0 && (
        <div className={`${colors.bg} border-l-[4px] border-dashed ${colors.border} pl-3 py-2 rounded-r-md text-xs shadow-sm`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`font-bold ${colors.label} uppercase tracking-wider text-[10px]`}>
              🎭 {language === 'es' ? 'Artes' : 'Arts'}
            </span>
            <span className="text-[9px] font-semibold bg-white/80 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">AUTO</span>
          </div>
          <div className="space-y-1">
            {artsItems.map((item, idx) => (
              <div key={idx} className={`flex items-start gap-1.5 ${colors.text}`}>
                <span className="shrink-0 w-4 text-center">{item.icon}</span>
                <span className="font-medium">{item.label}:</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}