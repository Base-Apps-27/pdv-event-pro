/**
 * ArtsTypeDance.jsx — Dance fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 * 2026-02-28 audit fix: Added missing handheld/headset mic fields and
 *   dance_has_song toggle (matching old form + Segment schema + backend allowlist).
 */
import React from 'react';
import ArtsSongSlots from './ArtsSongSlots';
import AutoGrowTextarea from './AutoGrowTextarea';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeDance({ seg, updateField, isUnica }) {
  const { t } = usePublicLang();
  return (
    <>
      {/* Mic counts — same pattern as Drama */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Handheld Mics</label>
          <input type="number" min="0" value={seg.dance_handheld_mics || ''} onChange={e => updateField('dance_handheld_mics', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Headset Mics</label>
          <input type="number" min="0" value={seg.dance_headset_mics || ''} onChange={e => updateField('dance_headset_mics', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
        </div>
      </div>

      {/* Cues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Inicio', 'Start Cue')}</label>
          <AutoGrowTextarea value={seg.dance_start_cue || ''} onChange={e => updateField('dance_start_cue', e.target.value)} minRows={2} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Fin', 'End Cue')}</label>
          <AutoGrowTextarea value={seg.dance_end_cue || ''} onChange={e => updateField('dance_end_cue', e.target.value)} minRows={2} />
        </div>
      </div>

      {/* Song toggle — dance always shows songs (dance_has_song defaults to true visually 
           because dance almost always has music, but we still save the toggle for parity with the schema) */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={seg.dance_has_song !== false} onChange={e => updateField('dance_has_song', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
        {t('Incluye playlist/canción(es)', 'Includes playlist/song(s)')}
      </label>
      {seg.dance_has_song !== false && (
        <ArtsSongSlots prefix="dance" segment={seg} onFieldChange={updateField} isUnica={isUnica} />
      )}
    </>
  );
}