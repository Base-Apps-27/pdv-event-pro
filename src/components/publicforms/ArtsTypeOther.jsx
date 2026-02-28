/**
 * ArtsTypeOther.jsx — "Other" art type fields.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeOther({ seg, updateField }) {
  const { t } = usePublicLang();
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Descripción', 'Description')}</label>
      <textarea rows={3} value={seg.art_other_description || ''} onChange={e => updateField('art_other_description', e.target.value)}
        placeholder={t('Describe la presentación...', 'Describe the presentation...')}
        className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
    </div>
  );
}