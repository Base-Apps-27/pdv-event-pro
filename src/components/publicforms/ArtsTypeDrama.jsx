/**
 * ArtsTypeDrama.jsx — Drama fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import ArtsSongSlots from './ArtsSongSlots';
import AutoGrowTextarea from './AutoGrowTextarea';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeDrama({ seg, updateField, isUnica }) {
  const { t } = usePublicLang();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Handheld Mics</label>
          <input type="number" min="0" value={seg.drama_handheld_mics || ''} onChange={e => updateField('drama_handheld_mics', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Headset Mics</label>
          <input type="number" min="0" value={seg.drama_headset_mics || ''} onChange={e => updateField('drama_headset_mics', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Inicio', 'Start Cue')}</label>
          <AutoGrowTextarea value={seg.drama_start_cue || ''} onChange={e => updateField('drama_start_cue', e.target.value)} minRows={2} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Fin', 'End Cue')}</label>
          <AutoGrowTextarea value={seg.drama_end_cue || ''} onChange={e => updateField('drama_end_cue', e.target.value)} minRows={2} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={seg.drama_has_song || false} onChange={e => updateField('drama_has_song', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
        {t('Incluye playlist/canción(es)', 'Includes playlist/song(s)')}
      </label>
      {seg.drama_has_song && <ArtsSongSlots prefix="drama" segment={seg} onFieldChange={updateField} isUnica={isUnica} />}
    </>
  );
}