/**
 * DepartmentNotes — MyProgram Step 6
 * 
 * Renders department-specific notes from segment fields.
 * Each department maps to specific segment fields.
 * 'general' shows all notes; specific depts show only their field.
 * 
 * Decision: "MyProgram: department filters mirror report options + Livestream placeholder"
 */
import React from 'react';
import { useLanguage } from '@/components/utils/i18n';
import { getSegmentData } from '@/components/utils/segmentDataUtils';

// Maps department key → segment field(s) to display
const DEPT_FIELD_MAP = {
  projection: ['projection_notes'],
  sound: ['sound_notes', 'microphone_assignments'],
  ushers: ['ushers_notes'],
  translation: ['translation_notes'],
  stage_decor: ['stage_decor_notes'],
  hospitality: [], // Hospitality tasks are separate entity — placeholder
  coordination: ['prep_instructions', 'other_notes'],
  livestream: ['projection_notes'], // v1 placeholder: shows general + video fields
};

const DEPT_COLORS = {
  projection: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-800', label: 'text-slate-600' },
  sound: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-900', label: 'text-red-700' },
  ushers: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-900', label: 'text-green-700' },
  translation: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', label: 'text-purple-700' },
  stage_decor: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', label: 'text-purple-700' },
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
  prep_instructions: { es: 'Preparación', en: 'Preparation' },
  other_notes: { es: 'Notas', en: 'Notes' },
};

export default function DepartmentNotes({ segment, department }) {
  const { language, t } = useLanguage();

  // General shows nothing extra here — the timeline card handles general display
  if (department === 'general') return null;

  const fields = DEPT_FIELD_MAP[department] || [];
  const colors = DEPT_COLORS[department] || DEPT_COLORS.coordination;
  const getData = (field) => getSegmentData(segment, field);

  const notesContent = fields
    .map((field) => ({ field, value: getData(field) }))
    .filter((item) => item.value);

  if (notesContent.length === 0) return null;

  return (
    <div className="space-y-1 mt-1.5">
      {notesContent.map(({ field, value }) => (
        <div
          key={field}
          className={`${colors.bg} border-l-3 ${colors.border} pl-2.5 py-1.5 rounded-r text-xs border-l-[3px]`}
        >
          <span className={`font-bold ${colors.label} block mb-0.5`}>
            {FIELD_LABELS[field]?.[language] || field}:
          </span>
          <p className={`${colors.text} leading-snug whitespace-pre-wrap`}>{value}</p>
        </div>
      ))}
    </div>
  );
}