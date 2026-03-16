/**
 * EventClosedNotice — 2026-03-16
 * 
 * Gentle, branded notice shown when a public submission form's target event
 * has status "completed". Replaces the form content with a clear message
 * that submissions are no longer accepted.
 * 
 * Decision: "Block submission links with gentle notice for completed events"
 * Bilingual: English + Spanish via PublicFormLangContext.
 */
import React from 'react';
import { CheckCircle2, Calendar, MapPin } from 'lucide-react';
import { usePublicLang } from './PublicFormLangContext';

export default function EventClosedNotice({ event }) {
  const { t } = usePublicLang();

  const eventDate = event?.start_date
    ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '';

  return (
    <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Brand gradient top bar */}
      <div className="h-1.5 brand-gradient" />

      <div className="pt-10 pb-10 px-6 md:px-10 text-center">
        {/* Organization name */}
        <p className="text-[10px] font-extrabold text-pdv-teal uppercase tracking-[0.2em] mb-4">
          PALABRAS DE VIDA
        </p>

        {/* Success / completion icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>

        {/* Event name */}
        {event?.name && (
          <h3 className="text-lg text-gray-500 tracking-wide mb-2">
            {event.name}
          </h3>
        )}

        {/* Main message */}
        <h1 className="text-3xl md:text-4xl text-[#1A1A1A] mb-3 leading-tight">
          {t(
            'EVENTO FINALIZADO',
            'EVENT COMPLETED'
          )}
        </h1>

        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed mb-5">
          {t(
            'Este evento ya concluyó y las presentaciones de contenido se han cerrado. Gracias a todos los que contribuyeron.',
            'This event has concluded and content submissions are now closed. Thank you to everyone who contributed.'
          )}
        </p>

        {/* Event metadata */}
        {(eventDate || event?.location) && (
          <div className="flex justify-center flex-wrap gap-4 text-sm text-gray-400 font-medium">
            {eventDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-pdv-green" />
                <span>{eventDate}</span>
              </div>
            )}
            {event?.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-pdv-green" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}