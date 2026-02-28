/**
 * ArtsTypeVideo.jsx — Video fields extracted from ArtsSegmentAccordion.
 * 2026-02-28: Hybrid UX refactor — isolated per-type form content.
 */
import React from 'react';
import CompactFileAttach from './CompactFileAttach';
import { usePublicLang } from './PublicFormLangContext';
import VideoDurationInput from './VideoDurationInput';

export default function ArtsTypeVideo({ seg, updateField, isUnica }) {
  const { t } = usePublicLang();
  return (
    <>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Nombre del Video', 'Video Name')}</label>
        <input type="text" value={seg.video_name || ''} onChange={e => updateField('video_name', e.target.value)}
          className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
      </div>
      <div className={`text-sm leading-relaxed p-3 rounded-md border-l-4 ${isUnica ? 'bg-orange-50 border-amber-400 text-amber-800' : 'bg-blue-50 border-[#1F8A70] text-blue-800'}`}>
        {isUnica
          ? t('Solo archivos descargables: Google Drive, OneDrive o Dropbox (acceso público requerido).', 'Downloadable files only: Google Drive, OneDrive, or Dropbox (public access required).')
          : t('Google Drive, OneDrive o Dropbox (acceso público). Spotify/YouTube aceptados pero no recomendados.', 'Google Drive, OneDrive, or Dropbox (public access). Spotify/YouTube accepted but not recommended.')
        }
      </div>
      <CompactFileAttach
        value={seg.video_url || ''}
        onChange={v => updateField('video_url', v)}
        label={t('Video Final', 'Final Video')}
        accept=".mp4,.mov,.webm"
        placeholder="https://drive.google.com/..."
        helpText={t('Suba el video final (≤50MB) o pegue un enlace.', 'Upload the final video (≤50MB) or paste a download link.')}
      />
      {/* Location field — parity with admin editor (2026-02-28) */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Ubicación', 'Location')}</label>
        <input type="text" value={seg.video_location || ''} onChange={e => updateField('video_location', e.target.value)}
          placeholder="ProPresenter > Videos > Opening.mp4"
          className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <VideoDurationInput
          value={seg.video_length_sec}
          onChange={v => updateField('video_length_sec', v)}
          labelEs="Duración"
          labelEn="Duration"
          t={t}
        />
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Responsable', 'Owner')}</label>
          <input type="text" value={seg.video_owner || ''} onChange={e => updateField('video_owner', e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
        </div>
      </div>
    </>
  );
}