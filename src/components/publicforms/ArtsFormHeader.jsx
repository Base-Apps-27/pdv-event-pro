/**
 * ArtsFormHeader.jsx
 * 
 * Header component for the public arts submission form.
 * Displays branding, event info, and gradient bar.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsFormHeader({ event }) {
    const { t } = usePublicLang();
    const eventDate = event?.start_date
        ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : '';

    return (
        <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="h-1.5 brand-gradient" />
            <div className="pt-8 pb-6 px-6 md:px-8 text-center">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1" style={{ color: '#1F8A70' }}>
                    PALABRAS DE VIDA
                </p>
                <h1 className="text-4xl md:text-5xl text-[#1A1A1A] mb-2 leading-none">
                    {t('ENTREGA DE MATERIAL ARTÍSTICO', 'ARTS MATERIAL SUBMISSION')}
                </h1>
                <h3 className="text-lg text-gray-500 tracking-wide mb-1">
                    {event?.name || t('Evento', 'Event')}
                </h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-snug">
                    {t(
                        'Suba archivos finales listos para instalar: canciones, videos, documentos de guía.',
                        'Upload final, ready-to-install files: songs, videos, run-of-show documents.'
                    )}
                </p>
                <div className="flex justify-center flex-wrap gap-4 mt-3 text-sm text-gray-400 font-medium">
                    {eventDate && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" style={{ color: '#8DC63F' }} />
                            <span>{eventDate}</span>
                        </div>
                    )}
                    {event?.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" style={{ color: '#8DC63F' }} />
                            <span>{event.location}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}