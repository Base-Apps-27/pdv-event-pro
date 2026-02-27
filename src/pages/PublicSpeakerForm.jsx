/**
 * PublicSpeakerForm.js
 * 
 * Public React page for speakers to submit sermon verses/content.
 * Replaces serveSpeakerSubmission (SSR HTML) which was blocked by platform CDN CSP.
 * 
 * CSP Migration (2026-02-27): This page runs inside the trusted React app shell,
 * bypassing CDN-level CSP restrictions that block inline scripts in function-served HTML.
 * Data is fetched from getSpeakerFormData (JSON API), submission goes to submitSpeakerContent.
 * 
 * Public route — no auth required. Added to Layout's isPublicPage list.
 * Accepts ?event_id=xxx query param (auto-detects if omitted).
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import SpeakerFormHeader from '@/components/publicforms/SpeakerFormHeader';
import SpeakerSubmissionForm from '@/components/publicforms/SpeakerSubmissionForm';

export default function PublicSpeakerForm() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [event, setEvent] = useState(null);
    const [options, setOptions] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const eventId = urlParams.get('event_id');

            const payload = {};
            if (eventId) payload.event_id = eventId;

            const response = await base44.functions.invoke('getSpeakerFormData', payload);
            const data = response.data;

            if (data.error && !data.event) {
                setError(data.error);
            } else {
                setEvent(data.event);
                setOptions(data.options || []);
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
                <div className="w-full max-w-[600px]">
                    <SpeakerFormHeader event={null} />
                    <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 font-medium">
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-5">
            <div className="w-full max-w-[600px]">
                <SpeakerFormHeader event={event} />
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    Comparta sus notas o bosquejo para la proyección de versículos.
                </p>
                <SpeakerSubmissionForm options={options} />
            </div>
        </div>
    );
}