/**
 * SpeakerSubmissionForm.jsx
 * 
 * The actual form for speakers to submit sermon verses/content.
 * Calls submitSpeakerContent backend function via base44.functions.invoke.
 * 
 * CSP Migration (2026-02-27): Replaces inline JS from serveSpeakerSubmission.
 * Uses base44 SDK invoke (same-origin, trusted shell) instead of raw fetch.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2 } from 'lucide-react';
import FileOrLinkInput from './FileOrLinkInput';
import { usePublicLang } from './PublicFormLangContext';

export default function SpeakerSubmissionForm({ options }) {
    const { t } = usePublicLang();
    const [segmentId, setSegmentId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [presentationUrl, setPresentationUrl] = useState('');
    const [notesUrl, setNotesUrl] = useState('');
    const [slidesOnly, setSlidesOnly] = useState(false);
    const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

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
            presentation_url: presentationUrl,
            notes_url: notesUrl,
            content_is_slides_only: slidesOnly,
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

            {/* Section 1: Session Info */}
            <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6">
                <h3 className="text-xl text-pdv-teal tracking-wide mb-4">
                    {t('INFORMACIÓN DE LA SESIÓN', 'SESSION INFORMATION')}
                </h3>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {t('Seleccione su Plenaria', 'Select your Plenary')} <span className="text-red-600">*</span>
                    </label>
                    <select
                        value={segmentId}
                        onChange={e => setSegmentId(e.target.value)}
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

            {/* Section 2: Visual Material */}
            <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6">
                <h3 className="text-xl text-pdv-teal tracking-wide mb-4">
                    {t('MATERIAL VISUAL Y NOTAS', 'VISUAL MATERIAL & NOTES')}
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-xs leading-relaxed text-blue-800">
                    {t(
                        '⚠️ Solo material terminado y listo para instalar. Suba o enlace archivos finales (presentaciones, imágenes, PDFs) que serán cargados en los sistemas de proyección. Si necesita crear algo nuevo, coordine con la oficina primero.',
                        '⚠️ Ready-to-install files only. Upload or link final files (slides, images, PDFs) that will be loaded into the projection systems. If something needs to be created, contact the office first.'
                    )}
                </div>
                <div className="mb-4">
                    <FileOrLinkInput
                        value={presentationUrl}
                        onChange={setPresentationUrl}
                        label={t('Presentación / Slides Finales (Opcional)', 'Final Presentation / Slides (Optional)')}
                        accept="image/*,.pdf,.pptx"
                        placeholder="https://drive.google.com/..."
                        helpText={t('Suba el archivo final (≤50MB) o pegue un enlace.', 'Upload the final file (≤50MB) or paste a link.')}
                    />
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <input
                        type="checkbox"
                        id="slidesOnly"
                        checked={slidesOnly}
                        onChange={e => setSlidesOnly(e.target.checked)}
                        className="w-4.5 h-4.5 accent-[#1F8A70]"
                    />
                    <label htmlFor="slidesOnly" className="text-sm font-medium text-gray-700 cursor-pointer">
                        {t('Este material contiene todo el contenido (No se requieren versículos aparte)', 'This material contains all the content (No separate verses needed)')}
                    </label>
                </div>
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

            {/* Section 3: Verses */}
            <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6">
                <h3 className="text-xl text-pdv-teal tracking-wide mb-4">
                    {t('VERSÍCULOS PARA PROYECCIÓN', 'VERSES FOR PROJECTION')}
                </h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                    {t(
                        'Para proyectar sus textos bíblicos en pantalla, necesitamos identificarlos. Por favor, pegue aquí sus notas o bosquejo completo. Nuestro sistema identificará y extraerá automáticamente todos los versículos por usted.',
                        'To display your Bible texts on screen, we need to identify them. Please paste your complete notes or outline here. Our system will automatically identify and extract all the verses for you.'
                    )}
                </p>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {t('Pegue sus notas aquí (El sistema detectará los versículos)', 'Paste your notes here (The system will detect the verses)')}
                        {!slidesOnly && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required={!slidesOnly}
                        placeholder={slidesOnly
                            ? t("Si marcó 'Solo Slides', este campo es opcional.", "If you checked 'Slides Only', this field is optional.")
                            : t("No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto.", "No need to separate the verses. You can paste your entire document here and we'll do the rest.")
                        }
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white min-h-[180px] resize-y focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3.5 brand-gradient text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {status === 'loading' ? t('Enviando...', 'Submitting...') : t('ENVIAR MENSAJE', 'SUBMIT MESSAGE')}
            </button>
        </form>
    );
}