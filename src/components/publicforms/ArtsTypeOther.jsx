/**
 * ArtsTypeOther.jsx — "Other" art type fields.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import AutoGrowTextarea from './AutoGrowTextarea';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeOther({ seg, updateField }) {
  const { t } = usePublicLang();
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Descripción', 'Description')}</label>
      <AutoGrowTextarea value={seg.art_other_description || ''} onChange={e => updateField('art_other_description', e.target.value)}
        placeholder={t('Describe la presentación...', 'Describe the presentation...')} minRows={3} />
    </div>
  );
}