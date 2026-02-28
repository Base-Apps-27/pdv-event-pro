/**
 * PublicArtsForm.js
 * 
 * PUBLIC React page for Arts Directors to submit technical/creative details.
 * This is the SOLE arts form surface — the old SSR function (serveArtsSubmission) is deprecated.
 * 
 * Data is fetched from getArtsFormData (JSON API), submission goes to submitArtsSegment.
 * Public route — no auth required. Added to Layout's isPublicPage list.
 * Accepts ?event_id=xxx query param (auto-detects if omitted).
 * 
 * Build: 2026-02-27T18:00Z — forced deploy
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ArtsFormHeader from '@/components/publicforms/ArtsFormHeader';
import ArtsGateForm from '@/components/publicforms/ArtsGateForm';
import ArtsSegmentAccordion from '@/components/publicforms/ArtsSegmentAccordion';
import { PublicFormLangProvider } from '@/components/publicforms/PublicFormLangContext';
import PublicFormLangToggle from '@/components/publicforms/PublicFormLangToggle';

export default function PublicArtsForm() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [event, setEvent] = useState(null);
    const [segments, setSegments] = useState([]);
    const [isUnica, setIsUnica] = useState(false);
    const [gateUser, setGateUser] = useState(null); // { name, email }

    useEffect(() => {
        const loadData = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const eventId = urlParams.get('event_id');
            const payload = {};
            if (eventId) payload.event_id = eventId;

            const response = await base44.functions.invoke('getArtsFormData', payload);
            const data = response.data;

            if (data.error && !data.event) {
                setError(data.error);
            } else {
                setEvent(data.event);
                setSegments(data.segments || []);
                setIsUnica(data.isUnicaEvent || false);
            }
            setLoading(false);
        };
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4 md:p-8">
                <div className="text-center text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-[#1F8A70] border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-sm font-medium">Cargando formulario...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-[720px]">
                    <ArtsFormHeader event={null} />
                    <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 font-medium">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <PublicFormLangProvider>
        <div className="min-h-screen bg-[#F0F1F3] p-4 md:p-8">
            <div className="w-full max-w-[720px] mx-auto">
                <div className="flex justify-end mb-2">
                    <PublicFormLangToggle />
                </div>
                <ArtsFormHeader event={event} />

                {!gateUser ? (
                    <ArtsGateForm onEnter={setGateUser} />
                ) : (
                    <ArtsFormContent segments={segments} gateUser={gateUser} isUnica={isUnica} />
                )}
            </div>
        </div>
        </PublicFormLangProvider>
    );
}

// Extracted to a component so it can use the hook
function ArtsFormContent({ segments, gateUser, isUnica }) {
    const { usePublicLang: _unused, ...rest } = {};
    // We import at top level so just use the hook
    const { t } = require('@/components/publicforms/PublicFormLangContext').usePublicLang();
    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200 border-l-4 p-5 mb-6 text-sm text-gray-500 leading-relaxed" style={{ borderLeftColor: '#8DC63F' }}>
                {t(
                    'A continuación encontrará los segmentos de Artes para este evento. Abra cada uno para ingresar los detalles de su presentación. Puede guardar progreso parcial y regresar luego para completar.',
                    'Below you\'ll find the Arts segments for this event. Open each one to enter your presentation details. You can save partial progress and return later to complete.'
                )}
            </div>

            {segments.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <h2 className="text-2xl text-gray-500 mb-2">{t('NO HAY SEGMENTOS DE ARTES', 'NO ARTS SEGMENTS')}</h2>
                    <p>{t('No se encontraron segmentos de tipo "Artes" para este evento.', 'No "Arts" type segments were found for this event.')}</p>
                </div>
                        ) : (
                            segments.map(seg => (
                                <ArtsSegmentAccordion
                                    key={seg.id}
                                    segment={seg}
                                    submitterName={gateUser.name}
                                    submitterEmail={gateUser.email}
                                    isUnica={isUnica}
                                />
                            ))
                        )}
                    </>
                )}
            </div>
        </div>
        </PublicFormLangProvider>
    );
}