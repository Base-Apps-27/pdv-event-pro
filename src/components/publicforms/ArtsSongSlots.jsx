/**
 * ArtsSongSlots.jsx
 * 
 * Song slot cards for dance/drama sections in the arts form.
 * CSP Migration (2026-02-27): Replaces inline JS renderSongSlots from serveArtsSubmission.
 * 2026-02-28: Song URL fields upgraded to FileOrLinkInput (upload + link hybrid).
 */
import React from 'react';
import CompactFileAttach from './CompactFileAttach';
import { usePublicLang } from './PublicFormLangContext';

function SongCard({ label, titleVal, urlVal, ownerVal, onTitleChange, onUrlChange, onOwnerChange, t }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-3 pb-2 border-b border-gray-100" style={{ color: '#1F8A70' }}>
                {label}
            </div>
            <div className="mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t('Título', 'Title')}</label>
                <input type="text" value={titleVal} onChange={e => onTitleChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
            </div>
            <div className="mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t('Persona a cargo', 'Person in charge')}</label>
                <input type="text" value={ownerVal} onChange={e => onOwnerChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
            </div>
            <CompactFileAttach
                value={urlVal}
                onChange={onUrlChange}
                label={t('Archivo Final', 'Final File')}
                accept=".mp3,.wav,.mp4,.ogg,.webm"
                placeholder="https://drive.google.com/..."
                helpText={t('Suba el archivo final (≤50MB) o pegue un enlace de descarga.', 'Upload the final file (≤50MB) or paste a download link.')}
            />
        </div>
    );
}

export default function ArtsSongSlots({ prefix, segment, onFieldChange, isUnica }) {
    const { t } = usePublicLang();
    const p = prefix; // 'dance' or 'drama'
    return (
        <div>
            <div className={`text-sm leading-relaxed p-3 rounded-md mb-3 border-l-4 ${isUnica ? 'bg-orange-50 border-amber-400 text-amber-800' : 'bg-blue-50 border-[#1F8A70] text-blue-800'}`}>
                {isUnica
                    ? t('Solo archivos descargables: Google Drive, OneDrive o Dropbox (acceso público requerido). No Spotify/YouTube.', 'Downloadable files only: Google Drive, OneDrive, or Dropbox (public access required). No Spotify/YouTube.')
                    : t('Google Drive, OneDrive o Dropbox (acceso público requerido). Spotify/YouTube aceptados pero no recomendados.', 'Google Drive, OneDrive, or Dropbox (public access required). Spotify/YouTube accepted but not recommended.')
                }
            </div>
            <SongCard label={t('Canción 1', 'Song 1')} t={t}
                titleVal={segment[`${p}_song_title`] || ''}
                urlVal={segment[`${p}_song_source`] || ''}
                ownerVal={segment[`${p}_song_owner`] || ''}
                onTitleChange={v => onFieldChange(`${p}_song_title`, v)}
                onUrlChange={v => onFieldChange(`${p}_song_source`, v)}
                onOwnerChange={v => onFieldChange(`${p}_song_owner`, v)}
            />
            <SongCard label={t('Canción 2 (Opcional)', 'Song 2 (Optional)')} t={t}
                titleVal={segment[`${p}_song_2_title`] || ''}
                urlVal={segment[`${p}_song_2_url`] || ''}
                ownerVal={segment[`${p}_song_2_owner`] || ''}
                onTitleChange={v => onFieldChange(`${p}_song_2_title`, v)}
                onUrlChange={v => onFieldChange(`${p}_song_2_url`, v)}
                onOwnerChange={v => onFieldChange(`${p}_song_2_owner`, v)}
            />
            <SongCard label={t('Canción 3 (Opcional)', 'Song 3 (Optional)')} t={t}
                titleVal={segment[`${p}_song_3_title`] || ''}
                urlVal={segment[`${p}_song_3_url`] || ''}
                ownerVal={segment[`${p}_song_3_owner`] || ''}
                onTitleChange={v => onFieldChange(`${p}_song_3_title`, v)}
                onUrlChange={v => onFieldChange(`${p}_song_3_url`, v)}
                onOwnerChange={v => onFieldChange(`${p}_song_3_owner`, v)}
            />
        </div>
    );
}