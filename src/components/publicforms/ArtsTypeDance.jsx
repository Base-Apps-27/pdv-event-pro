/**
 * ArtsTypeDance.jsx — Dance fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import ArtsSongSlots from './ArtsSongSlots';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeDance({ seg, updateField, isUnica }) {
  const { t } = usePublicLang();
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Inicio', 'Start Cue')}</label>
          <textarea rows={2} value={seg.dance_start_cue || ''} onChange={e => updateField('dance_start_cue', e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Fin', 'End Cue')}</label>
          <textarea rows={2} value={seg.dance_end_cue || ''} onChange={e => updateField('dance_end_cue', e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
        </div>
      </div>
      <ArtsSongSlots prefix="dance" segment={seg} onFieldChange={updateField} isUnica={isUnica} />
    </>
  );
}