/**
 * WeeklySubmissionForm.jsx
 * 
 * The actual form for pastors to submit weekly sermon verses/content.
 * Calls submitWeeklyServiceContent backend function via base44.functions.invoke.
 * 
 * CSP Migration (2026-02-27): Replaces inline JS from serveWeeklyServiceSubmission.
 * Preserves all features: optgroup selectors, title auto-populate, apply-to-siblings,
 * slides-only mode, notes URL, and idempotency.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2 } from 'lucide-react';
import FileOrLinkInput from './FileOrLinkInput';
import { usePublicLang } from './PublicFormLangContext';

export default function WeeklySubmissionForm({ serviceGroups, siblingMap }) {
    const { t } = usePublicLang();
    const [segmentId, setSegmentId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [presentationUrl, setPresentationUrl] = useState('');
    const [notesUrl, setNotesUrl] = useState('');
    const [slidesOnly, setSlidesOnly] = useState(false);
    const [mirrorTargets, setMirrorTargets] = useState({}); // { siblingId: boolean }
    const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

    // Get current siblings for selected segment
    const currentSiblings = useMemo(() => {
        return siblingMap[segmentId] || [];
    }, [segmentId, siblingMap]);

    const handleSegmentChange = useCallback((newId) => {
        setSegmentId(newId);
        setMirrorTargets({});
        // Auto-populate title from the selected option
        for (const group of serviceGroups) {
            const opt = group.options.find(o => o.id === newId);
            if (opt) {
                setTitle(opt.title || '');
                break;
            }
        }
    }, [serviceGroups]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!segmentId) return;
        if (!slidesOnly && !content.trim()) return;

        setStatus('loading');
        setErrorMsg('');

        const checkedTargets = Object.entries(mirrorTargets).filter(([_, v]) => v).map(([id]) => id);

        const response = await base44.functions.invoke('submitWeeklyServiceContent', {
            segment_id: segmentId,
            content: content,
            title: title,
            presentation_url: presentationUrl,
            notes_url: notesUrl,
            content_is_slides_only: slidesOnly,
            mirror_target_ids: checkedTargets,
            idempotencyKey: idempotencyKey
        });

        if (response.data?.error) {
            setStatus('error');
            setErrorMsg(response.data.error);
        } else {
            setStatus('success');
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
                <div className="h-1.5 brand-gradient" />
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl text-[#1A1A1A] mb-3">{t('¡CONTENIDO RECIBIDO!', 'CONTENT RECEIVED!')}</h1>
                    <p className="text-gray-500 mb-6">{t('Sus notas han sido recibidas y los versículos están siendo procesados.', 'Your notes have been received and the verses are being processed.')}</p>
                    <button onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                        {t('Enviar otro', 'Submit another')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {status === 'error' && (
                <div className="p-4 rounded-lg mb-6 bg-red-50 text-red-800 border border-red-200 font-medium">
                    {errorMsg || t('Error al enviar. Intente nuevamente.', 'Error submitting. Please try again.')}
                </div>
            )}

            {/* Segment Selector */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    {t('Seleccione su Horario y Nombre', 'Select your Time Slot and Name')} <span className="text-red-600">*</span>
                </label>
                <select value={segmentId} onChange={e => handleSegmentChange(e.target.value)} required
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10">
                    <option value="" disabled>{t('Seleccione...', 'Select...')}</option>
                    {serviceGroups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                            {group.options.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            {/* Title */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t('Título del Mensaje', 'Message Title')}</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Título de la predicación (Opcional)', 'Sermon title (Optional)')}
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
            </div>

            {/* Presentation URL + Slides Only */}
            <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-xs leading-relaxed text-blue-800">
                    {t(
                        'Por favor suba únicamente material final listo para proyección. Si necesita crear o ajustar algún contenido, le pedimos coordinar primero con la oficina para asegurar que todo esté preparado correctamente.',
                        'Please upload only final material ready for projection. If you need to create or adjust any content, please coordinate with the office first to ensure everything is properly prepared.'
                    )}
                </div>
                <FileOrLinkInput
                    value={presentationUrl}
                    onChange={setPresentationUrl}
                    label={t('Presentación / Slides Finales (Opcional)', 'Final Presentation / Slides (Optional)')}
                    accept="image/*,.pdf,.pptx"
                    placeholder="https://dropbox.com/..."
                    helpText={t('Suba el archivo final (≤50MB) o pegue un enlace.', 'Upload the final file (≤50MB) or paste a link.')}
                />
                <div className="mt-3" />
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
                    <input type="checkbox" checked={slidesOnly} onChange={e => setSlidesOnly(e.target.checked)} className="w-4.5 h-4.5 accent-[#1F8A70]" />
                    {t('Este material contiene todo el contenido (No se requieren versículos aparte)', 'This material contains all the content (No separate verses needed)')}
                </label>
                {slidesOnly && (
                    <div>
                        <FileOrLinkInput
                            value={notesUrl}
                            onChange={setNotesUrl}
                            label={t('Bosquejo / Notas Finales (PDF o Doc)', 'Final Outline / Notes (PDF or Doc)')}
                            accept=".pdf,.doc,.docx"
                            placeholder={t('Enlace a notas (Opcional)', 'Link to notes (Optional)')}
                            helpText={t('Suba el PDF final o pegue un enlace.', 'Upload the final PDF or paste a link.')}
                        />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    {t('Pegue su mensaje completo (para extracción de versículos)', 'Paste your complete message (for verse extraction)')}
                    {!slidesOnly && <span className="text-red-600 ml-1">*</span>}
                </label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required={!slidesOnly}
                    placeholder={slidesOnly
                        ? t("Si marcó 'Solo Slides', este campo es opcional.", "If you checked 'Slides Only', this field is optional.")
                        : t("No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente.", "No need to separate the verses manually. Just paste your complete outline or notes here, and the system will detect and extract the Bible references automatically.")
                    }
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white min-h-[200px] resize-y focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                />
            </div>

            {/* Apply to siblings */}
            {currentSiblings.length > 0 && (
                <div className="mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        {currentSiblings.length === 1 ? (
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={!!mirrorTargets[currentSiblings[0].id]}
                                    onChange={e => setMirrorTargets(prev => ({ ...prev, [currentSiblings[0].id]: e.target.checked }))}
                                    className="w-5 h-5 mt-0.5 accent-[#1F8A70] flex-shrink-0" />
                                <div>
                                    <span className="text-sm font-medium text-green-800">{t(`Aplicar también al servicio de ${currentSiblings[0].label}`, `Also apply to the ${currentSiblings[0].label} service`)}</span>
                                    <span className="block text-xs text-green-600">{t('El mismo mensaje y versículos se aplicarán a ambos servicios.', 'The same message and verses will be applied to both services.')}</span>
                                </div>
                            </label>
                        ) : (
                            <div>
                                <div className="text-xs font-semibold text-green-800 uppercase mb-2">{t('Aplicar también a:', 'Also apply to:')}</div>
                                {currentSiblings.map(sib => (
                                    <label key={sib.id} className="flex items-center gap-2.5 mb-2 last:mb-0 cursor-pointer">
                                        <input type="checkbox" checked={!!mirrorTargets[sib.id]}
                                            onChange={e => setMirrorTargets(prev => ({ ...prev, [sib.id]: e.target.checked }))}
                                            className="w-5 h-5 accent-[#1F8A70]" />
                                        <span className="text-sm font-medium text-green-800">{sib.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button type="submit" disabled={status === 'loading'}
                className="w-full py-3.5 brand-gradient text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {status === 'loading' ? t('Enviando...', 'Submitting...') : t('ENVIAR Y PROCESAR', 'SUBMIT & PROCESS')}
            </button>
        </form>
    );
}