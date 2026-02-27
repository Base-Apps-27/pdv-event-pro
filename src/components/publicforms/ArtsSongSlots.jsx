/**
 * ArtsSongSlots.jsx
 * 
 * Song slot cards for dance/drama sections in the arts form.
 * CSP Migration (2026-02-27): Replaces inline JS renderSongSlots from serveArtsSubmission.
 */
import React from 'react';

function SongCard({ label, titleVal, urlVal, ownerVal, onTitleChange, onUrlChange, onOwnerChange }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-3 pb-2 border-b border-gray-100" style={{ color: '#1F8A70' }}>
                {label}
            </div>
            <div className="mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Título / Title</label>
                <input type="text" value={titleVal} onChange={e => onTitleChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Responsable / Owner</label>
                    <input type="text" value={ownerVal} onChange={e => onOwnerChange(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Enlace / Link</label>
                    <input type="url" value={urlVal} onChange={e => onUrlChange(e.target.value)} placeholder="https://drive.google.com/..."
                        className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
                </div>
            </div>
        </div>
    );
}

export default function ArtsSongSlots({ prefix, segment, onFieldChange, isUnica }) {
    const p = prefix; // 'dance' or 'drama'
    return (
        <div>
            <div className={`text-sm leading-relaxed p-3 rounded-md mb-3 border-l-4 ${isUnica ? 'bg-orange-50 border-amber-400 text-amber-800' : 'bg-blue-50 border-[#1F8A70] text-blue-800'}`}>
                {isUnica
                    ? <><strong>Política Única:</strong> Solo archivos descargables (Drive/OneDrive/Dropbox, acceso público). No Spotify/YouTube. / <em>Única Policy: Downloadable files only (Drive/OneDrive/Dropbox, public access). No Spotify/YouTube.</em></>
                    : <><strong>General:</strong> Google Drive, OneDrive o Dropbox (acceso público preferido). Spotify/YouTube aceptados pero no recomendados. / <em>Google Drive, OneDrive, or Dropbox (public access preferred). Spotify/YouTube accepted but not recommended.</em></>
                }
            </div>
            <SongCard label="Canción 1 / Song 1"
                titleVal={segment[`${p}_song_title`] || ''}
                urlVal={segment[`${p}_song_source`] || ''}
                ownerVal={segment[`${p}_song_owner`] || ''}
                onTitleChange={v => onFieldChange(`${p}_song_title`, v)}
                onUrlChange={v => onFieldChange(`${p}_song_source`, v)}
                onOwnerChange={v => onFieldChange(`${p}_song_owner`, v)}
            />
            <SongCard label="Canción 2 / Song 2 (Opcional)"
                titleVal={segment[`${p}_song_2_title`] || ''}
                urlVal={segment[`${p}_song_2_url`] || ''}
                ownerVal={segment[`${p}_song_2_owner`] || ''}
                onTitleChange={v => onFieldChange(`${p}_song_2_title`, v)}
                onUrlChange={v => onFieldChange(`${p}_song_2_url`, v)}
                onOwnerChange={v => onFieldChange(`${p}_song_2_owner`, v)}
            />
            <SongCard label="Canción 3 / Song 3 (Opcional)"
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