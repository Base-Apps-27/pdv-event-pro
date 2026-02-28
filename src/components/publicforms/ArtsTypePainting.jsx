/**
 * ArtsTypePainting.jsx — Painting fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import AutoGrowTextarea from './AutoGrowTextarea';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypePainting({ seg, updateField }) {
  const { t } = usePublicLang();
  return (
    <>
      <p className="text-xs text-gray-500">{t('Seleccione lo que necesita para su presentación:', 'Select what you need for your presentation:')}</p>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={seg.painting_needs_easel || false} onChange={e => updateField('painting_needs_easel', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
          {t('Caballete / Easel', 'Easel')}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={seg.painting_needs_drop_cloth || false} onChange={e => updateField('painting_needs_drop_cloth', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
          {t('Protección de piso / Drop Cloth', 'Drop Cloth / Floor Protection')}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={seg.painting_needs_lighting || false} onChange={e => updateField('painting_needs_lighting', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
          {t('Iluminación especial', 'Special Lighting')}
        </label>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Tamaño del Lienzo', 'Canvas Size')}</label>
        <input type="text" value={seg.painting_canvas_size || ''} onChange={e => updateField('painting_canvas_size', e.target.value)}
          placeholder={t('Ej: 24x36 pulgadas', 'E.g. 24x36 inches')}
          className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Otros Requisitos de Montaje', 'Other Setup Requirements')}</label>
        <AutoGrowTextarea value={seg.painting_other_setup || ''} onChange={e => updateField('painting_other_setup', e.target.value)}
          placeholder={t('Mesa, agua, toallas, etc.', 'Table, water, towels, etc.')} minRows={2} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Notas Adicionales', 'Additional Notes')}</label>
        <AutoGrowTextarea value={seg.painting_notes || ''} onChange={e => updateField('painting_notes', e.target.value)} minRows={2} />
      </div>
    </>
  );
}