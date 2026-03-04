/**
 * SpeakerSubmissionForm.jsx
 * 
 * The actual form for speakers to submit sermon verses/content.
 * Calls submitSpeakerContent backend function via base44.functions.invoke.
 * 
 * CSP Migration (2026-02-27): Replaces inline JS from serveSpeakerSubmission.
 * Uses base44 SDK invoke (same-origin, trusted shell) instead of raw fetch.
 * 
 * UX Refactor (2026-02-28): 2-step path fork replaces flat form layout.
 * Path A ("notes") = paste message + optional slides. Path B ("slides") = upload deck + optional outline.
 * The slidesOnly checkbox is eliminated. Path choice sets content_is_slides_only implicitly.
 */
import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2 } from 'lucide-react';
import MultiFileOrLinkInput from './MultiFileOrLinkInput';
import { usePublicLang } from './PublicFormLangContext';
import SubmissionPathSelector from './SubmissionPathSelector';
import { collectDeviceInfo } from './collectDeviceInfo';

export default function SpeakerSubmissionForm({ options }) {
    const { t } = usePublicLang();
    const [submissionPath, setSubmissionPath] = useState(''); // 'notes' | 'slides'
    const [segmentId, setSegmentId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [presentationUrls, setPresentationUrls] = useState([]);
    const [notesUrls, setNotesUrls] = useState([]);
    const [website, setWebsite] = useState(''); // Honeypot: hidden from humans, bots auto-fill
    const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    // Refs for auto-scroll after selections
    const sessionSectionRef = useRef(null);
    const contentSectionRef = useRef(null);

    // Derived from path choice — replaces the old slidesOnly checkbox
    const slidesOnly = submissionPath === 'slides';

    // Generate a stable idempotency key per mount
    const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

    // Group options by session_name
    const grouped = useMemo(() => {
        const groups = {};
        (options || []).forEach(opt => {
            const group = opt.session_name || 'Otras Sesiones';
            if (!groups[group]) groups[group] = [];
            groups[group].push(opt);
        });
        return groups;
    }, [options]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!segmentId) return;
        if (!slidesOnly && !content.trim()) return;

        setStatus('loading');
        setErrorMsg('');

        const response = await base44.functions.invoke('submitSpeakerContent', {
            segment_id: segmentId,
            content: content,
            title: title,
            presentation_url: presentationUrls,
            notes_url: notesUrls,
            content_is_slides_only: slidesOnly,
            idempotencyKey: idempotencyKey,
            // 2026-03-01: Browser/device metadata for audit trail
            device_info: collectDeviceInfo(),
            // Honeypot: backend silently accepts but discards if filled (2026-02-28)
            ...(website ? { website } : {}),
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
                    <h1 className="text-4xl text-[#1A1A1A] mb-3">{t('¡MENSAJE RECIBIDO!', 'MESSAGE RECEIVED!')}</h1>
                    <p className="text-gray-500">
                        {t('Gracias por enviar su contenido. El equipo procesará las referencias automáticamente.', 'Thank you for submitting your content. The team will process the references automatically.')}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        {t('Enviar otro mensaje', 'Submit another message')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {/* Honeypot: invisible to humans, bots auto-fill. aria-hidden + tabIndex=-1 + offscreen (2026-02-28) */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
            {/* Status messages */}
            {status === 'loading' && (
                <div className="flex items-center gap-3 p-4 rounded-lg mb-6 bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                    {t('Enviando mensaje...', 'Submitting message...')}
                </div>
            )}
            {status === 'error' && (
                <div className="flex items-center gap-3 p-4 rounded-lg mb-6 bg-red-50 text-red-800 border border-red-200 font-medium">
                    {errorMsg || t('Error al enviar. Intente nuevamente.', 'Error submitting. Please try again.')}
                </div>
            )}

            {/* Step 1: Path Selection — determines which fields appear below */}
            <SubmissionPathSelector value={submissionPath} onChange={setSubmissionPath} nextSectionRef={sessionSectionRef} />

            {/* Everything below only shows once a path is selected */}
            {submissionPath && (<>

            {/* Section 1: Session Info */}
            <div ref={sessionSectionRef} className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6 scroll-mt-4">
                <h3 className="text-xl text-pdv-teal tracking-wide mb-4">
                    {t('INFORMACIÓN DE LA SESIÓN', 'SESSION INFORMATION')}
                </h3>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {t('Seleccione su Plenaria', 'Select your Plenary')} <span className="text-red-600">*</span>
                    </label>
                    <select
                        value={segmentId}
                        onChange={e => {
                            setSegmentId(e.target.value);
                            if (e.target.value) setTimeout(() => contentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                        }}
                        required
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    >
                        <option value="" disabled>{t('Seleccione una opción...', 'Select an option...')}</option>
                        {Object.entries(grouped).map(([groupName, groupOpts]) => (
                            <optgroup key={groupName} label={groupName}>
                                {groupOpts.map(opt => {
                                    let label = opt.speaker;
                                    if (opt.message_title) {
                                        const t = opt.message_title.trim();
                                        const isQuoted = t.startsWith('"') || t.startsWith("'");
                                        label += ` • ${isQuoted ? t : '"' + t + '"'}`;
                                    } else {
                                        label += ` • ${opt.title}`;
                                    }
                                    return (
                                        <option key={opt.id} value={opt.id}>{label}</option>
                                    );
                                })}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {t('Título del Mensaje (Opcional)', 'Message Title (Optional)')}
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder={t('Título de la predicación', 'Sermon title')}
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    />
                </div>
            </div>

            {/* PATH A ("notes"): Paste first, optional slides second */}
            {submissionPath === 'notes' && (
                <>
                    {/* Primary: Verses / Paste content */}
                    <div ref={contentSectionRef} className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6 scroll-mt-4">
                        <h3 className="text-xl text-pdv-teal tracking-wide mb-4">
                            {t('VERSÍCULOS PARA PROYECCIÓN', 'VERSES FOR PROJECTION')}
                        </h3>
                        {/* Instruction banner — makes the primary action crystal clear */}
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-xs leading-relaxed text-amber-800">
                            <span className="font-bold">{t('📋 Pegue su texto aquí', '📋 Paste your text here')}</span>{' '}
                            {t(
                                'Copie y pegue sus notas, bosquejo o documento completo. Nuestro sistema identificará y extraerá automáticamente todos los versículos bíblicos para proyección.',
                                'Copy and paste your notes, outline, or full document. Our system will automatically identify and extract all Bible verses for projection.'
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                {t('Pegue sus notas aquí (El sistema detectará los versículos)', 'Paste your notes here (The system will detect the verses)')}
                                <span className="text-red-600 ml-1">*</span>
                            </label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                required
                                placeholder={t(
                                    "No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto.",
                                    "No need to separate the verses. You can paste your entire document here and we'll do the rest."
                                )}
                                className="w-full p-3 border border-gray-200 rounded-md text-base bg-white min-h-[180px] resize-y focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                            />
                        </div>
                    </div>

                    {/* Secondary: Optional supplemental slides */}
                    <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-gray-300 p-6 mb-6">
                        <h3 className="text-xl text-gray-500 tracking-wide mb-2">
                            {t('MATERIAL COMPLEMENTARIO (OPCIONAL)', 'SUPPLEMENTAL MATERIAL (OPTIONAL)')}
                        </h3>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                            {t(
                                'Si tiene slides o imágenes complementarias listas para proyección, súbalas aquí. NO suba su documento de notas/bosquejo, ya lo pegó arriba.',
                                'If you have supplemental slides or images ready for projection, upload them here. Do NOT upload your notes/outline document. You already pasted it above.'
                            )}
                        </p>
                        <MultiFileOrLinkInput
                            urls={presentationUrls}
                            onChange={setPresentationUrls}
                            maxCount={4}
                            label={t('Slides Complementarios (Opcional)', 'Supplemental Slides (Optional)')}
                            accept="image/*,.pdf,.pptx"
                            placeholder="https://drive.google.com/..."
                            helpText={t('Solo presentaciones o imágenes (≤50MB). No documentos Word.', 'Presentations or images only (≤50MB). Not Word documents.')}
                        />
                    </div>
                </>
            )}

            {/* PATH B ("slides"): Upload deck first, optional outline second */}
            {submissionPath === 'slides' && (
                <>
                    {/* Primary: Upload the finished presentation */}
                    <div ref={contentSectionRef} className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-blue-400 p-6 mb-6 scroll-mt-4">
                        <h3 className="text-xl text-blue-600 tracking-wide mb-4">
                            {t('PRESENTACIÓN FINAL', 'FINAL PRESENTATION')}
                        </h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-xs leading-relaxed text-blue-800">
                            {t(
                                'Suba su presentación terminada (PowerPoint, Keynote, PDF o imágenes). Este archivo se usará directamente para la proyección. Asegúrese de que esté en su versión final.',
                                'Upload your finished presentation (PowerPoint, Keynote, PDF, or images). This file will be used directly for projection. Make sure it is the final version.'
                            )}
                        </div>
                        <MultiFileOrLinkInput
                            urls={presentationUrls}
                            onChange={setPresentationUrls}
                            maxCount={4}
                            label={t('Presentación / Slides Finales', 'Final Presentation / Slides')}
                            accept="image/*,.pdf,.pptx"
                            placeholder="https://drive.google.com/..."
                            helpText={t('Suba el archivo final (≤50MB) o pegue un enlace.', 'Upload the final file (≤50MB) or paste a link.')}
                        />
                    </div>

                    {/* Secondary: Optional outline/notes for the media team */}
                    <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-gray-300 p-6 mb-6">
                        <h3 className="text-xl text-gray-500 tracking-wide mb-2">
                            {t('BOSQUEJO / NOTAS (OPCIONAL)', 'OUTLINE / NOTES (OPTIONAL)')}
                        </h3>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                            {t(
                                'Si tiene un bosquejo o guía para que el equipo de medios pueda seguir la presentación, súbalo aquí.',
                                'If you have an outline or guide so the media team can follow the presentation, upload it here.'
                            )}
                        </p>
                        <MultiFileOrLinkInput
                            urls={notesUrls}
                            onChange={setNotesUrls}
                            maxCount={4}
                            label={t('Bosquejo / Notas (Opcional)', 'Outline / Notes (Optional)')}
                            accept=".pdf,.doc,.docx"
                            placeholder={t('Enlace a notas', 'Link to notes')}
                            helpText={t('PDF, Word o enlace.', 'PDF, Word, or link.')}
                        />
                    </div>

                    {/* Optional paste — truly secondary for path B */}
                    <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-gray-200 p-6 mb-6">
                        <h3 className="text-xl text-gray-400 tracking-wide mb-2">
                            {t('TEXTO ADICIONAL (OPCIONAL)', 'ADDITIONAL TEXT (OPTIONAL)')}
                        </h3>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                            {t(
                                'Si desea agregar notas o texto adicional que no está en la presentación, puede pegarlo aquí.',
                                'If you want to add notes or additional text not in the presentation, you can paste it here.'
                            )}
                        </p>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={t(
                                "Opcional: solo si tiene texto adicional fuera de la presentación.",
                                "Optional: only if you have additional text outside the presentation."
                            )}
                            className="w-full p-3 border border-gray-200 rounded-md text-base bg-white min-h-[100px] resize-y focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                        />
                    </div>
                </>
            )}

            </>)}  {/* end submissionPath gate */}

            {submissionPath && (
                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full py-3.5 brand-gradient text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {status === 'loading' ? t('Enviando...', 'Submitting...') : t('ENVIAR MENSAJE', 'SUBMIT MESSAGE')}
                </button>
            )}
        </form>
    );
}