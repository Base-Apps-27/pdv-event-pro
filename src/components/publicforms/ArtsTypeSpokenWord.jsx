/**
 * ArtsTypeSpokenWord.jsx — Spoken Word fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import CompactFileAttach from './CompactFileAttach';
import AutoGrowTextarea from './AutoGrowTextarea';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsTypeSpokenWord({ seg, updateField }) {
  const { t } = usePublicLang();
  return (
    <>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Nombre del Orador', 'Speaker Name')}</label>
        <input type="text" value={seg.spoken_word_speaker || ''} onChange={e => updateField('spoken_word_speaker', e.target.value)}
          placeholder={t('¿Quién presentará el spoken word?', 'Who will perform the spoken word?')}
          className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Descripción / Título de la Pieza', 'Description / Piece Title')}</label>
        <AutoGrowTextarea value={seg.spoken_word_description || ''} onChange={e => updateField('spoken_word_description', e.target.value)}
          placeholder={t('Título, tema y contexto...', 'Title, theme, and context...')} minRows={2} />
      </div>
      <div>
       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Posición del Micrófono', 'Microphone Position')}</label>
       <select value={seg.spoken_word_mic_position || ''} onChange={e => updateField('spoken_word_mic_position', e.target.value)}
         className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]">
         <option value="">{t('Seleccione...', 'Select...')}</option>
         <option value="headset">Headset</option>
         <option value="handheld">Handheld</option>
         <option value="stand">{t('Atril / Stand', 'On a Stand')}</option>
         <option value="off_stage">{t('Fuera del escenario', 'Off Stage')}</option>
         <option value="lapel">Lapel</option>
         <option value="podium">{t('Podio', 'Podium')}</option>
       </select>
      </div>

      {/* Outfit and special items */}
      <div>
       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Vestuario (Colores)', 'Outfit (Colors)')}</label>
       <AutoGrowTextarea value={seg.spoken_word_outfit_colors || ''} onChange={e => updateField('spoken_word_outfit_colors', e.target.value)} placeholder={t('Describe los colores y estilos...', 'Describe colors and styles...')} minRows={2} />
      </div>

      <div>
       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Artículos Especiales', 'Special Items')}</label>
       <AutoGrowTextarea value={seg.spoken_word_special_items || ''} onChange={e => updateField('spoken_word_special_items', e.target.value)} placeholder={t('Props, accesorios, elementos especiales...', 'Props, accessories, special elements...')} minRows={2} />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('📎 ARCHIVOS', '📎 FILES')}</p>
        <CompactFileAttach value={seg.spoken_word_script_url || ''} onChange={v => updateField('spoken_word_script_url', v)}
          label={t('Guión / Script', 'Script / Guide')} accept=".pdf,.doc,.docx,.txt" placeholder="https://drive.google.com/..."
          helpText={t('Suba el guión (≤50MB) o pegue un enlace.', 'Upload the script (≤50MB) or paste a link.')} />
        <CompactFileAttach value={seg.spoken_word_audio_url || ''} onChange={v => updateField('spoken_word_audio_url', v)}
          label={t('Audio del Spoken Word', 'Spoken Word Audio')} accept=".mp3,.wav,.ogg,.webm,.mp4" placeholder="https://drive.google.com/..."
          helpText={t('Suba la grabación (≤50MB) o pegue un enlace.', 'Upload the recording (≤50MB) or paste a link.')} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={seg.spoken_word_has_music || false} onChange={e => updateField('spoken_word_has_music', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
        {t('Incluye música de fondo', 'Includes background music')}
      </label>
      {seg.spoken_word_has_music && (
        <div className="space-y-3 pl-3 border-l-2 border-amber-300">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Título de la Pista', 'Track Title')}</label>
            <input type="text" value={seg.spoken_word_music_title || ''} onChange={e => updateField('spoken_word_music_title', e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
          </div>
          <CompactFileAttach value={seg.spoken_word_music_url || ''} onChange={v => updateField('spoken_word_music_url', v)}
            label={t('Archivo de Música', 'Music File')} accept=".mp3,.wav,.mp4,.ogg,.webm" placeholder="https://drive.google.com/..." />
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Persona a cargo', 'Person in charge')}</label>
            <input type="text" value={seg.spoken_word_music_owner || ''} onChange={e => updateField('spoken_word_music_owner', e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Notas Adicionales', 'Additional Notes')}</label>
        <AutoGrowTextarea value={seg.spoken_word_notes || ''} onChange={e => updateField('spoken_word_notes', e.target.value)}
          placeholder={t('Detalles para el equipo técnico...', 'Details for the technical team...')} minRows={2} />
      </div>
    </>
  );
}