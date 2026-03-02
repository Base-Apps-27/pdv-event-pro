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
import { PublicFormLangProvider } from '@/components/publicforms/PublicFormLangContext';
import PublicFormLangToggle from '@/components/publicforms/PublicFormLangToggle';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorCard from '@/components/ui/ErrorCard';

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
        return <LoadingSpinner size="fullPage" label="Cargando formulario..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-[640px]">
                    <SpeakerFormHeader event={null} />
                    <ErrorCard message={error} onRetry={() => window.location.reload()} />
                </div>
            </div>
        );
    }

    return (
        <PublicFormLangProvider>
            <div className="min-h-screen bg-[#F0F1F3] p-4 md:p-8">
                <div className="w-full max-w-[640px] mx-auto">
                    <div className="flex justify-end mb-2">
                        <PublicFormLangToggle />
                    </div>
                    <SpeakerFormHeader event={event} />
                    <SpeakerSubmissionForm options={options} />
                </div>
            </div>
        </PublicFormLangProvider>
    );
}