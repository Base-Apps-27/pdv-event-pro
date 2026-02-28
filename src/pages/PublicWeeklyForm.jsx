/**
 * PublicWeeklyForm.js
 * 
 * Public React page for pastors to submit weekly sermon verses/content.
 * Replaces serveWeeklyServiceSubmission (SSR HTML) which was blocked by platform CDN CSP.
 * 
 * CSP Migration (2026-02-27): This page runs inside the trusted React app shell,
 * bypassing CDN-level CSP restrictions that block inline scripts in function-served HTML.
 * Data is fetched from getWeeklyFormData (JSON API), submission goes to submitWeeklyServiceContent.
 * 
 * Public route — no auth required. Added to Layout's isPublicPage list.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import WeeklyFormHeader from '@/components/publicforms/WeeklyFormHeader';
import WeeklySubmissionForm from '@/components/publicforms/WeeklySubmissionForm';
import { PublicFormLangProvider } from '@/components/publicforms/PublicFormLangContext';
import PublicFormLangToggle from '@/components/publicforms/PublicFormLangToggle';

export default function PublicWeeklyForm() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serviceGroups, setServiceGroups] = useState([]);
    const [siblingMap, setSiblingMap] = useState({});

    useEffect(() => {
        const loadData = async () => {
            const response = await base44.functions.invoke('getWeeklyFormData', {});
            const data = response.data;

            if (data.error && (!data.serviceGroups || data.serviceGroups.length === 0)) {
                setError(data.error);
            } else {
                setServiceGroups(data.serviceGroups || []);
                setSiblingMap(data.siblingMap || {});
                if (data.error) setError(data.error); // "no services" message
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

    return (
        <PublicFormLangProvider>
        <div className="min-h-screen bg-[#F0F1F3] p-4 md:p-8">
            <div className="w-full max-w-[640px] mx-auto">
                <div className="flex justify-end mb-2">
                    <PublicFormLangToggle />
                </div>
                <WeeklyFormHeader />

                {error && serviceGroups.length === 0 ? (
                    <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 font-medium">{error}</div>
                ) : (
                    <WeeklySubmissionForm serviceGroups={serviceGroups} siblingMap={siblingMap} />
                )}
            </div>
        </div>
        </PublicFormLangProvider>
    );
}