/**
 * PublicArtsForm.js
 * 
 * Public React page for Arts Directors to submit technical/creative details.
 * Replaces serveArtsSubmission (SSR HTML) which was blocked by platform CDN CSP.
 * 
 * CSP Migration (2026-02-27): This page runs inside the trusted React app shell,
 * bypassing CDN-level CSP restrictions that block inline scripts in function-served HTML.
 * Data is fetched from getArtsFormData (JSON API), submission goes to submitArtsSegment.
 * 
 * Public route — no auth required. Added to Layout's isPublicPage list.
 * Accepts ?event_id=xxx query param (auto-detects if omitted).
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ArtsFormHeader from '@/components/publicforms/ArtsFormHeader';
import ArtsGateForm from '@/components/publicforms/ArtsGateForm';
import ArtsSegmentAccordion from '@/components/publicforms/ArtsSegmentAccordion';

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
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-5">
                <div className="text-center text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-[#1F8A70] border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-sm font-medium">Cargando formulario...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-5">
                <div className="w-full max-w-[700px]">
                    <ArtsFormHeader event={null} />
                    <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 font-medium">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-5">
            <div className="w-full max-w-[700px]">
                <ArtsFormHeader event={event} />

                {!gateUser ? (
                    <ArtsGateForm onEnter={setGateUser} />
                ) : (
                    <>
                        <div className="bg-gray-50 rounded-lg border-l-4 border-[#8DC63F] p-5 mb-6 text-sm text-gray-500 leading-relaxed">
                            A continuación encontrará los segmentos de Artes para este evento.
                            Abra cada uno para ingresar los detalles de su presentación.
                            Puede guardar progreso parcial y regresar luego para completar.
                            <br /><em className="text-gray-400">Below you'll find the Arts segments for this event.
                            Open each one to enter your presentation details.
                            You can save partial progress and return later to complete.</em>
                        </div>

                        {segments.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <h2 className="text-2xl text-gray-500 mb-2">NO HAY SEGMENTOS DE ARTES</h2>
                                <p>No se encontraron segmentos de tipo "Artes" para este evento.</p>
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
    );
}