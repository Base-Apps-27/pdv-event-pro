/**
 * ArtsFormHeader.jsx
 * 
 * Header component for the public arts submission form.
 * Displays branding, event info, and gradient bar.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

export default function ArtsFormHeader({ event }) {
    const eventDate = event?.start_date
        ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : '';

    return (
        <div className="relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F]" />
            <div className="pt-10 pb-8 px-8 text-center">
                <p className="text-xs font-extrabold text-[#1F8A70] uppercase tracking-widest mb-1">
                    PALABRAS DE VIDA
                </p>
                <h1 className="text-5xl text-[#1A1A1A] mb-2 leading-none">
                    FORMULARIO DE ARTES
                </h1>
                <p className="text-lg font-semibold text-gray-500 uppercase tracking-wide">
                    {event?.name || 'Evento'}
                </p>
                <div className="flex justify-center flex-wrap gap-4 mt-4 text-sm text-gray-400 font-medium">
                    {eventDate && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#8DC63F]" />
                            <span>{eventDate}</span>
                        </div>
                    )}
                    {event?.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#8DC63F]" />
                            <span>{event.location}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}