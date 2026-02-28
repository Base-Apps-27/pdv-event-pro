/**
 * ArtsSegmentAccordion.jsx
 * 
 * Single accordion item for an arts segment. Contains type selectors,
 * dance/drama/video/other sub-sections, notes, and save button.
 * CSP Migration (2026-02-27): Replaces inline JS accordion from serveArtsSubmission.
 */
import React, { useState, useCallback, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ArtsSongSlots from './ArtsSongSlots';
import FileOrLinkInput from './FileOrLinkInput';
import { usePublicLang } from './PublicFormLangContext';

const TYPE_LABELS = { DANCE: '🩰 Danza', DRAMA: '🎭 Drama', VIDEO: '🎬 Video', SPOKEN_WORD: '🎤 Spoken Word', PAINTING: '🎨 Pintura', OTHER: '✨ Otro' };

function calcStatus(seg) {
    const types = seg.art_types || [];
    if (types.length === 0) return { level: 'incomplete', label: '🔴 Incompleto' };
    const hasDance = types.includes('DANCE');
    const hasDrama = types.includes('DRAMA');
    const hasVideo = types.includes('VIDEO');
    const hasAnySong = !!(seg.dance_song_source || seg.drama_song_source || seg.dance_song_title || seg.drama_song_title);
    const hasVideoLink = !!seg.video_url;
    const hasRunOfShow = !!seg.arts_run_of_show_url;
    const hasAnyAsset = hasAnySong || hasVideoLink || hasRunOfShow;
    const missing = [];
    if (!hasAnyAsset) missing.push('link');
    if (hasDance && !seg.dance_start_cue) missing.push('dance cue');
    if (hasDrama && !seg.drama_start_cue) missing.push('drama cue');
    if (hasVideo && !seg.video_url) missing.push('video url');
    if (missing.length === 0) return { level: 'complete', label: '🟢 Completo' };
    if (hasAnyAsset) return { level: 'minimum', label: '🟡 Mínimo' };
    return { level: 'incomplete', label: '🔴 Incompleto' };
}

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function ArtsSegmentAccordion({ segment: initialSeg, submitterName, submitterEmail, isUnica }) {
    const { t } = usePublicLang();
    const [seg, setSeg] = useState({ ...initialSeg });
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);

    // Track which fields the user has actually touched (edited at least once).
    // Used at save-time to attach a field-presence summary to analytics,
    // answering "did the user enter data before saving?" without per-keystroke noise.
    const touchedFieldsRef = useRef(new Set());

    const updateField = useCallback((field, value) => {
        setSeg(prev => ({ ...prev, [field]: value }));
        // Record first touch per field (fires once per field, not per keystroke)
        if (!touchedFieldsRef.current.has(field)) {
            touchedFieldsRef.current.add(field);
            base44.analytics.track({
                eventName: 'arts_field_edited',
                properties: { segment_id: initialSeg.id, field_name: field }
            });
        }
    }, [initialSeg.id]);

    const toggleType = useCallback((type, checked) => {
        setSeg(prev => {
            const set = new Set(prev.art_types || []);
            if (checked) set.add(type); else set.delete(type);
            return { ...prev, art_types: Array.from(set) };
        });
        // Analytics: track art type toggle for interaction visibility
        base44.analytics.track({
            eventName: 'arts_type_toggled',
            properties: { segment_id: initialSeg.id, type, action: checked ? 'add' : 'remove' }
        });
    }, [initialSeg.id]);

    /**
     * handleSave — CRITICAL BUG FIX (2026-02-28):
     * Previously had NO try/catch. If the backend threw or the network failed,
     * setSaving(false) never ran → button stuck at "Guardando..." forever.
     * This caused ghost failures on "Hosanna" and "Can't Steal My Joy" segments.
     * Now wrapped in try/catch + analytics tracking for full observability.
     */
    const handleSave = async () => {
        setSaving(true);
        setSaveMsg(null);
        const saveStart = Date.now();

        // Analytics: track save attempt with field-presence summary (2026-02-28).
        // Answers "was data actually entered when Save was run?" without tracking keystrokes.
        // Each boolean indicates whether the field has a truthy value at save time.
        const d = payload.data;
        const filledFields = Object.entries(d).filter(([_, v]) => {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'number') return v > 0;
            if (Array.isArray(v)) return v.length > 0;
            return !!v && v !== '';
        }).map(([k]) => k);

        base44.analytics.track({
            eventName: 'arts_save_attempt',
            properties: {
                segment_id: seg.id,
                segment_title: seg.title || '',
                art_types: (seg.art_types || []).join(','),
                filled_field_count: filledFields.length,
                total_field_count: Object.keys(d).length,
                filled_fields: filledFields.join(','),
                touched_field_count: touchedFieldsRef.current.size,
                touched_fields: Array.from(touchedFieldsRef.current).join(',')
            }
        });

        const payload = {
            segment_id: seg.id,
            submitter_name: submitterName,
            submitter_email: submitterEmail,
            data: {
                art_types: seg.art_types || [],
                dance_has_song: seg.dance_has_song || false, dance_handheld_mics: seg.dance_handheld_mics ?? '', dance_headset_mics: seg.dance_headset_mics ?? '',
                dance_start_cue: seg.dance_start_cue || '', dance_end_cue: seg.dance_end_cue || '',
                dance_song_title: seg.dance_song_title || '', dance_song_source: seg.dance_song_source || '', dance_song_owner: seg.dance_song_owner || '',
                dance_song_2_title: seg.dance_song_2_title || '', dance_song_2_url: seg.dance_song_2_url || '', dance_song_2_owner: seg.dance_song_2_owner || '',
                dance_song_3_title: seg.dance_song_3_title || '', dance_song_3_url: seg.dance_song_3_url || '', dance_song_3_owner: seg.dance_song_3_owner || '',
                drama_has_song: seg.drama_has_song || false, drama_handheld_mics: seg.drama_handheld_mics ?? '', drama_headset_mics: seg.drama_headset_mics ?? '',
                drama_start_cue: seg.drama_start_cue || '', drama_end_cue: seg.drama_end_cue || '',
                drama_song_title: seg.drama_song_title || '', drama_song_source: seg.drama_song_source || '', drama_song_owner: seg.drama_song_owner || '',
                drama_song_2_title: seg.drama_song_2_title || '', drama_song_2_url: seg.drama_song_2_url || '', drama_song_2_owner: seg.drama_song_2_owner || '',
                drama_song_3_title: seg.drama_song_3_title || '', drama_song_3_url: seg.drama_song_3_url || '', drama_song_3_owner: seg.drama_song_3_owner || '',
                has_video: (seg.art_types || []).includes('VIDEO'), video_name: seg.video_name || '', video_url: seg.video_url || '',
                video_owner: seg.video_owner || '', video_length_sec: seg.video_length_sec ?? '', video_location: seg.video_location || '',
                art_other_description: seg.art_other_description || '', arts_run_of_show_url: seg.arts_run_of_show_url || '',
                description_details: seg.description_details || '',
                // Spoken Word (expanded 2026-02-28 with description, speaker, script)
                spoken_word_mic_position: seg.spoken_word_mic_position || '', spoken_word_has_music: seg.spoken_word_has_music || false,
                spoken_word_music_title: seg.spoken_word_music_title || '', spoken_word_music_url: seg.spoken_word_music_url || '',
                spoken_word_music_owner: seg.spoken_word_music_owner || '', spoken_word_notes: seg.spoken_word_notes || '',
                spoken_word_description: seg.spoken_word_description || '',
                spoken_word_speaker: seg.spoken_word_speaker || '',
                spoken_word_script_url: seg.spoken_word_script_url || '',
                // Painting
                painting_needs_easel: seg.painting_needs_easel || false, painting_needs_drop_cloth: seg.painting_needs_drop_cloth || false,
                painting_needs_lighting: seg.painting_needs_lighting || false, painting_canvas_size: seg.painting_canvas_size || '',
                painting_other_setup: seg.painting_other_setup || '', painting_notes: seg.painting_notes || '',
            }
        };

        try {
            const res = await base44.functions.invoke('submitArtsSegment', payload);

            if (res.data?.error) {
                setSaveMsg({ type: 'error', text: '❌ Error: ' + res.data.error });
                base44.analytics.track({
                    eventName: 'arts_save_error',
                    properties: { segment_id: seg.id, error_message: res.data.error, duration_ms: Date.now() - saveStart }
                });
            } else {
                setSaveMsg({ type: 'success', text: '✅ Guardado exitosamente / Saved successfully' });
                base44.analytics.track({
                    eventName: 'arts_save_success',
                    properties: { segment_id: seg.id, duration_ms: Date.now() - saveStart }
                });
            }
        } catch (err) {
            // CRITICAL: This catch ensures the button ALWAYS resets.
            // Before this fix, network errors left the form permanently frozen.
            setSaveMsg({ type: 'error', text: '❌ Error de conexión / Connection error. ' + (err.message || '') });
            base44.analytics.track({
                eventName: 'arts_save_error',
                properties: { segment_id: seg.id, error_message: err.message || 'unknown', duration_ms: Date.now() - saveStart }
            });
        } finally {
            setSaving(false);
        }
    };

    const status = calcStatus(seg);
    const types = seg.art_types || [];
    const statusColors = { incomplete: 'bg-red-100 text-red-800', minimum: 'bg-yellow-100 text-yellow-800', complete: 'bg-green-100 text-green-800' };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 hover:border-gray-300 transition-colors">
            <button onClick={() => {
                const willOpen = !open;
                setOpen(willOpen);
                // Analytics: track segment open/close for interaction visibility
                if (willOpen) {
                    base44.analytics.track({
                        eventName: 'arts_segment_opened',
                        properties: { segment_id: seg.id, segment_title: seg.title || '' }
                    });
                }
            }} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{seg.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{seg.session_name}{seg.start_time ? ` • ${formatTime(seg.start_time)}` : ''}{seg.presenter ? ` • ${seg.presenter}` : ''}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {types.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">{TYPE_LABELS[t] || t}</span>)}
                    </div>
                    {seg.arts_last_submitted_by && (
                        <div className="text-[10px] text-gray-400 mt-1 truncate">
                            Última edición: {seg.arts_last_submitted_by}{seg.arts_last_submitted_at ? ` • ${new Date(seg.arts_last_submitted_at).toLocaleDateString('es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                        </div>
                    )}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColors[status.level]}`}>{status.label}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 ml-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-gray-200 p-5 space-y-5">
                    {/* Ready-to-install guidance banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs leading-relaxed text-blue-800">
                        {t(
                            'Por favor suba únicamente material final listo para proyección. Si necesita crear o ajustar algún contenido, le pedimos coordinar primero con la oficina para asegurar que todo esté preparado correctamente.',
                            'Please upload only final material ready for projection. If you need to create or adjust any content, please coordinate with the office first to ensure everything is properly prepared.'
                        )}
                    </div>

                    {/* Art Type Selection */}
                    <div>
                        <h4 className="text-lg tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('TIPO DE ARTE', 'ART TYPE')}</h4>
                        <div className="flex flex-wrap gap-3">
                            {['DANCE', 'DRAMA', 'VIDEO', 'SPOKEN_WORD', 'PAINTING', 'OTHER'].map(t => (
                                <label key={t} className={`flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-md border transition-all ${types.includes(t) ? 'bg-blue-50 border-[#1F8A70] text-blue-800 font-semibold' : 'border-gray-200 hover:border-[#1F8A70]'}`}>
                                    <input type="checkbox" checked={types.includes(t)} onChange={e => toggleType(t, e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
                                    {TYPE_LABELS[t]}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Dance Section — songs are primary (no toggle), cues for coordination */}
                    {types.includes('DANCE') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('🩰 DANZA', '🩰 DANCE')}</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Inicio', 'Start Cue')}</label><textarea rows={2} value={seg.dance_start_cue || ''} onChange={e => updateField('dance_start_cue', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Fin', 'End Cue')}</label><textarea rows={2} value={seg.dance_end_cue || ''} onChange={e => updateField('dance_end_cue', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                            </div>
                            {/* Songs always shown for dance — dance primarily uses songs */}
                            <ArtsSongSlots prefix="dance" segment={seg} onFieldChange={updateField} isUnica={isUnica} />
                        </div>
                    )}

                    {/* Drama Section */}
                    {types.includes('DRAMA') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('🎭 DRAMA', '🎭 DRAMA')}</h5>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Handheld Mics</label><input type="number" min="0" value={seg.drama_handheld_mics || ''} onChange={e => updateField('drama_handheld_mics', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Headset Mics</label><input type="number" min="0" value={seg.drama_headset_mics || ''} onChange={e => updateField('drama_headset_mics', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Inicio', 'Start Cue')}</label><textarea rows={2} value={seg.drama_start_cue || ''} onChange={e => updateField('drama_start_cue', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Cue de Fin', 'End Cue')}</label><textarea rows={2} value={seg.drama_end_cue || ''} onChange={e => updateField('drama_end_cue', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                            </div>
                            <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
                                <input type="checkbox" checked={seg.drama_has_song || false} onChange={e => updateField('drama_has_song', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
                                {t('Incluye playlist/canción(es)', 'Includes playlist/song(s)')}
                            </label>
                            {seg.drama_has_song && <ArtsSongSlots prefix="drama" segment={seg} onFieldChange={updateField} isUnica={isUnica} />}
                        </div>
                    )}

                    {/* Video Section */}
                    {types.includes('VIDEO') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('🎬 VIDEO', '🎬 VIDEO')}</h5>
                            <div className="mb-3"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Nombre del Video', 'Video Name')}</label><input type="text" value={seg.video_name || ''} onChange={e => updateField('video_name', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                            <div className={`text-sm leading-relaxed p-3 rounded-md mb-3 border-l-4 ${isUnica ? 'bg-orange-50 border-amber-400 text-amber-800' : 'bg-blue-50 border-[#1F8A70] text-blue-800'}`}>
                                {isUnica
                                    ? t('Solo archivos descargables: Google Drive, OneDrive o Dropbox (acceso público requerido). No Spotify/YouTube.', 'Downloadable files only: Google Drive, OneDrive, or Dropbox (public access required). No Spotify/YouTube.')
                                    : t('Google Drive, OneDrive o Dropbox (acceso público requerido). Spotify/YouTube aceptados pero no recomendados.', 'Google Drive, OneDrive, or Dropbox (public access required). Spotify/YouTube accepted but not recommended.')
                                }
                            </div>
                            <div className="mb-3">
                                <FileOrLinkInput
                                    value={seg.video_url || ''}
                                    onChange={v => updateField('video_url', v)}
                                    label={t('Video Final', 'Final Video')}
                                    accept=".mp4,.mov,.webm"
                                    placeholder="https://drive.google.com/..."
                                    helpText={t('Suba el video final (≤50MB) o pegue un enlace de descarga.', 'Upload the final video (≤50MB) or paste a download link.')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Duración (seg)', 'Length (sec)')}</label><input type="number" min="0" value={seg.video_length_sec || ''} onChange={e => updateField('video_length_sec', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Responsable', 'Owner')}</label><input type="text" value={seg.video_owner || ''} onChange={e => updateField('video_owner', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                            </div>
                        </div>
                    )}

                    {/* Spoken Word Section — expanded 2026-02-28 with description, speaker, script per arts admin feedback */}
                    {types.includes('SPOKEN_WORD') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('🎤 SPOKEN WORD', '🎤 SPOKEN WORD')}</h5>
                            {/* New: Speaker name */}
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Nombre del Orador', 'Speaker Name')}</label>
                                <input type="text" value={seg.spoken_word_speaker || ''} onChange={e => updateField('spoken_word_speaker', e.target.value)}
                                    placeholder={t('¿Quién presentará el spoken word?', 'Who will perform the spoken word?')}
                                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" />
                            </div>
                            {/* New: Description (title, theme, context) */}
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Descripción / Título de la Pieza', 'Description / Piece Title')}</label>
                                <textarea rows={2} value={seg.spoken_word_description || ''} onChange={e => updateField('spoken_word_description', e.target.value)}
                                    placeholder={t('Título, tema y contexto de la pieza...', 'Title, theme, and context of the piece...')}
                                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
                            </div>
                            {/* New: Script upload */}
                            <div className="mb-3">
                                <FileOrLinkInput
                                    value={seg.spoken_word_script_url || ''}
                                    onChange={v => updateField('spoken_word_script_url', v)}
                                    label={t('Guión / Script', 'Script / Guide')}
                                    accept=".pdf,.doc,.docx,.txt"
                                    placeholder="https://drive.google.com/..."
                                    helpText={t('Suba el guión (≤50MB) o pegue un enlace.', 'Upload the script (≤50MB) or paste a link.')}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Posición del Micrófono', 'Microphone Position')}</label>
                                <select value={seg.spoken_word_mic_position || ''} onChange={e => updateField('spoken_word_mic_position', e.target.value)}
                                    className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]">
                                    <option value="">{t('Seleccione...', 'Select...')}</option>
                                    <option value="headset">Headset</option>
                                    <option value="handheld">Handheld</option>
                                    <option value="stand">{t('En atril / Stand', 'On a Stand')}</option>
                                    <option value="off_stage">{t('Fuera del escenario', 'Off Stage')}</option>
                                    <option value="lapel">Lapel</option>
                                    <option value="podium">{t('Podio', 'Podium')}</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
                                <input type="checkbox" checked={seg.spoken_word_has_music || false} onChange={e => updateField('spoken_word_has_music', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />
                                {t('Incluye música de fondo', 'Includes background music')}
                            </label>
                            {seg.spoken_word_has_music && (
                                <div className="space-y-3 mb-3 pl-3 border-l-2 border-[#8DC63F]">
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Título de la Pista', 'Track Title')}</label><input type="text" value={seg.spoken_word_music_title || ''} onChange={e => updateField('spoken_word_music_title', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                                    <FileOrLinkInput value={seg.spoken_word_music_url || ''} onChange={v => updateField('spoken_word_music_url', v)} label={t('Archivo de Música', 'Music File')} accept=".mp3,.wav,.mp4,.ogg,.webm" placeholder="https://drive.google.com/..." />
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Responsable', 'Owner')}</label><input type="text" value={seg.spoken_word_music_owner || ''} onChange={e => updateField('spoken_word_music_owner', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                                </div>
                            )}
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Notas Adicionales', 'Additional Notes')}</label><textarea rows={2} value={seg.spoken_word_notes || ''} onChange={e => updateField('spoken_word_notes', e.target.value)} placeholder={t('Detalles para el equipo técnico...', 'Details for the technical team...')} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                        </div>
                    )}

                    {/* Painting Section */}
                    {types.includes('PAINTING') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('🎨 PINTURA', '🎨 PAINTING')}</h5>
                            <p className="text-xs text-gray-500 mb-3">{t('Seleccione lo que necesita para su presentación:', 'Select what you need for your presentation:')}</p>
                            <div className="space-y-2 mb-3">
                                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={seg.painting_needs_easel || false} onChange={e => updateField('painting_needs_easel', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />{t('Caballete / Easel', 'Easel')}</label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={seg.painting_needs_drop_cloth || false} onChange={e => updateField('painting_needs_drop_cloth', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />{t('Protección de piso / Drop Cloth', 'Drop Cloth / Floor Protection')}</label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={seg.painting_needs_lighting || false} onChange={e => updateField('painting_needs_lighting', e.target.checked)} className="w-4 h-4 accent-[#1F8A70]" />{t('Iluminación especial', 'Special Lighting')}</label>
                            </div>
                            <div className="mb-3"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Tamaño del Lienzo', 'Canvas Size')}</label><input type="text" value={seg.painting_canvas_size || ''} onChange={e => updateField('painting_canvas_size', e.target.value)} placeholder={t('Ej: 24x36 pulgadas', 'E.g. 24x36 inches')} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]" /></div>
                            <div className="mb-3"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Otros Requisitos de Montaje', 'Other Setup Requirements')}</label><textarea rows={2} value={seg.painting_other_setup || ''} onChange={e => updateField('painting_other_setup', e.target.value)} placeholder={t('Mesa, agua, toallas, etc.', 'Table, water, towels, etc.')} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Notas Adicionales', 'Additional Notes')}</label><textarea rows={2} value={seg.painting_notes || ''} onChange={e => updateField('painting_notes', e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" /></div>
                        </div>
                    )}

                    {/* Other Section */}
                    {types.includes('OTHER') && (
                        <div className="bg-gray-50 border border-gray-200 border-l-4 rounded-lg p-5" style={{ borderLeftColor: '#8DC63F' }}>
                            <h5 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('✨ OTRO', '✨ OTHER')}</h5>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('Descripción', 'Description')}</label>
                            <textarea rows={3} value={seg.art_other_description || ''} onChange={e => updateField('art_other_description', e.target.value)} placeholder={t('Describe la presentación...', 'Describe the presentation...')} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
                        </div>
                    )}

                    {/* Arts Run of Show */}
                    <div>
                        <h4 className="text-lg tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('📋 GUÍA DE ARTES', '📋 ARTS RUN OF SHOW')}</h4>
                        <div className="text-sm leading-relaxed p-3 rounded-md mb-3 border-l-4 bg-blue-50 border-[#1F8A70] text-blue-800">
                            {t(
                                'Por favor suba únicamente material final listo para proyección. Si necesita crear o ajustar algún contenido, le pedimos coordinar primero con la oficina para asegurar que todo esté preparado correctamente.',
                                'Please upload only final material ready for projection. If you need to create or adjust any content, please coordinate with the office first to ensure everything is properly prepared.'
                            )}
                        </div>
                        <FileOrLinkInput
                            value={seg.arts_run_of_show_url || ''}
                            onChange={v => updateField('arts_run_of_show_url', v)}
                            label={t('Guía Final (PDF/Documento)', 'Final Run of Show (PDF/Document)')}
                            accept=".pdf,.doc,.docx,image/*"
                            placeholder="https://drive.google.com/..."
                            helpText={t('Suba el archivo final (≤50MB) o pegue un enlace.', 'Upload the final file (≤50MB) or paste a link.')}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <h4 className="text-lg tracking-wide mb-3" style={{ color: '#1F8A70' }}>{t('📝 NOTAS ADICIONALES', '📝 ADDITIONAL NOTES')}</h4>
                        <textarea rows={3} value={seg.description_details || ''} onChange={e => updateField('description_details', e.target.value)} placeholder={t('Cualquier detalle adicional para el equipo técnico...', 'Any additional details for the technical team...')} className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white resize-y focus:outline-none focus:border-[#1F8A70]" />
                    </div>

                    {/* Save Button — inline gradient for reliable rendering on public pages */}
                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-3.5 text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)' }}>
                        {saving ? t('⏳ Guardando...', '⏳ Saving...') : t('💾 GUARDAR PROGRESO', '💾 SAVE PROGRESS')}
                    </button>
                    {saveMsg && <p className={`text-center text-sm font-medium mt-2 ${saveMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                        {saveMsg.type === 'success' ? t('✅ Guardado exitosamente', '✅ Saved successfully') : saveMsg.text}
                    </p>}
                </div>
            )}
        </div>
    );
}