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

export default function WeeklySubmissionForm({ serviceGroups, siblingMap }) {
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F]" />
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl text-[#1A1A1A] mb-3">¡CONTENIDO RECIBIDO!</h1>
                    <p className="text-gray-500 mb-6">Sus notas han sido recibidas y los versículos están siendo procesados.</p>
                    <button onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                        Enviar otro
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {status === 'error' && (
                <div className="p-4 rounded-lg mb-6 bg-red-50 text-red-800 border border-red-200 font-medium">
                    {errorMsg || 'Error al enviar. Intente nuevamente.'}
                </div>
            )}

            {/* Segment Selector */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Seleccione su Horario y Nombre <span className="text-red-600">*</span>
                </label>
                <select value={segmentId} onChange={e => handleSegmentChange(e.target.value)} required
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10">
                    <option value="" disabled>Seleccione...</option>
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Título del Mensaje</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la predicación (Opcional)"
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
            </div>

            {/* Presentation URL + Slides Only */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Enlace a Presentación / Imágenes (Opcional)</label>
                <input type="url" value={presentationUrl} onChange={e => setPresentationUrl(e.target.value)} placeholder="https://dropbox.com/..."
                    className="w-full p-3 border border-gray-200 rounded-md text-base bg-white mb-3 focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
                    <input type="checkbox" checked={slidesOnly} onChange={e => setSlidesOnly(e.target.checked)} className="w-4.5 h-4.5 accent-[#1F8A70]" />
                    Este material contiene todo el contenido (No se requieren versículos aparte)
                </label>
                {slidesOnly && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Link de Bosquejo / Notas (PDF o Doc)</label>
                        <input type="url" value={notesUrl} onChange={e => setNotesUrl(e.target.value)} placeholder="Enlace a notas para el equipo de medios (Opcional)"
                            className="w-full p-3 border border-gray-200 rounded-md text-base bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Pegue su mensaje completo (para extracción de versículos)
                    {!slidesOnly && <span className="text-red-600 ml-1">*</span>}
                </label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required={!slidesOnly}
                    placeholder={slidesOnly
                        ? "Si marcó 'Solo Slides', este campo es opcional."
                        : "No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente."
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
                                    <span className="text-sm font-medium text-green-800">Aplicar también al servicio de {currentSiblings[0].label}</span>
                                    <span className="block text-xs text-green-600">El mismo mensaje y versículos se aplicarán a ambos servicios.</span>
                                </div>
                            </label>
                        ) : (
                            <div>
                                <div className="text-xs font-semibold text-green-800 uppercase mb-2">Aplicar también a:</div>
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
                className="w-full py-4 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F] text-white font-bold text-base uppercase tracking-wide rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
                {status === 'loading' ? 'Enviando...' : 'ENVIAR Y PROCESAR'}
            </button>
        </form>
    );
}