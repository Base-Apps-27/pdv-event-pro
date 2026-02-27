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

export default function SpeakerSubmissionForm({ options }) {
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F]" />
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl text-[#1A1A1A] mb-3">¡MENSAJE RECIBIDO!</h1>
                    <p className="text-gray-500">
                        Gracias por enviar su contenido. El equipo procesará las referencias automáticamente.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Enviar otro mensaje
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
                    Enviando mensaje...
                </div>
            )}
            {status === 'error' && (
                <div className="flex items-center gap-3 p-4 rounded-lg mb-6 bg-red-50 text-red-800 border border-red-200 font-medium">
                    {errorMsg || 'Error al enviar. Intente nuevamente.'}
                </div>
            )}

            {/* Section 1: Session Info */}
            <div className="bg-gray-50 rounded-lg border-l-4 border-[#1F8A70] p-6 mb-6">
                <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] tracking-wide mb-4">
                    INFORMACIÓN DE LA SESIÓN
                </h3>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Seleccione su Plenaria <span className="text-red-600">*</span>
                    </label>
                    <select
                        value={segmentId}
                        onChange={e => setSegmentId(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    >
                        <option value="" disabled>Seleccione una opción...</option>
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
                        Título del Mensaje (Opcional)
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Título de la predicación"
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    />
                </div>
            </div>

            {/* Section 2: Visual Material */}
            <div className="bg-gray-50 rounded-lg border-l-4 border-[#1F8A70] p-6 mb-6">
                <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] tracking-wide mb-4">
                    MATERIAL VISUAL Y NOTAS
                </h3>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Enlace a Presentación / Imágenes (Opcional)
                    </label>
                    <input
                        type="url"
                        value={presentationUrl}
                        onChange={e => setPresentationUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
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
                        Este material contiene todo el contenido (No se requieren versículos aparte)
                    </label>
                </div>
                {slidesOnly && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                            Link de Bosquejo / Notas (PDF o Doc)
                        </label>
                        <input
                            type="url"
                            value={notesUrl}
                            onChange={e => setNotesUrl(e.target.value)}
                            placeholder="Enlace a notas para el equipo de medios (Opcional)"
                            className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                        />
                    </div>
                )}
            </div>

            {/* Section 3: Verses */}
            <div className="bg-gray-50 rounded-lg border-l-4 border-[#1F8A70] p-6 mb-6">
                <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] tracking-wide mb-4">
                    VERSÍCULOS PARA PROYECCIÓN
                </h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                    Para proyectar sus textos bíblicos en pantalla, necesitamos identificarlos. Por favor,{' '}
                    <strong>pegue aquí sus notas o bosquejo completo</strong>. Nuestro sistema identificará
                    y extraerá automáticamente todos los versículos por usted.
                </p>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Pegue sus notas aquí (El sistema detectará los versículos)
                        {!slidesOnly && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required={!slidesOnly}
                        placeholder={slidesOnly
                            ? "Si marcó 'Solo Slides', este campo es opcional."
                            : "No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto."
                        }
                        className="w-full p-3 border border-gray-200 rounded-md text-base bg-white min-h-[180px] resize-y focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-4 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F] text-white font-bold text-base uppercase tracking-wide rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
                {status === 'loading' ? 'Enviando...' : 'ENVIAR MENSAJE'}
            </button>
        </form>
    );
}