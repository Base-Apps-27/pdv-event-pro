/**
 * PublicFormShell — P3 UX-1 (2026-03-02)
 * 
 * Shared wrapper for all 3 public form headers (Speaker, Weekly, Arts).
 * Provides consistent brand identity, responsive layout, and optional event metadata.
 * 
 * Props:
 *   title       — Main heading text (bilingual, provided by consumer)
 *   subtitle    — Optional subtitle below heading
 *   description — Optional description paragraph
 *   event       — Optional event object { name, start_date, location }
 *   children    — Additional content below the header (rare)
 */
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { usePublicLang } from './PublicFormLangContext';

export default function PublicFormShell({ title, subtitle, description, event, children }) {
  const { t } = usePublicLang();

  const eventDate = event?.start_date
    ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '';

  return (
    {/* 2026-03-19: color-scheme:light forces browser to render all form controls
         in light mode regardless of OS dark mode preference — prevents white-on-white
         text in textareas/inputs on dark-mode devices */}
    <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden mb-6" style={{ colorScheme: 'light' }}>
      {/* Brand gradient top bar */}
      <div className="h-1.5 brand-gradient" />

      <div className="pt-8 pb-6 px-6 md:px-8 text-center">
        {/* Organization name — consistent across all forms */}
        <p className="text-[10px] font-extrabold text-pdv-teal uppercase tracking-[0.2em] mb-1">
          PALABRAS DE VIDA
        </p>

        {/* Main title */}
        <h1 className="text-4xl md:text-5xl text-[#1A1A1A] mb-2 leading-none">
          {title}
        </h1>

        {/* Subtitle (event name or custom text) */}
        {subtitle && (
          <h3 className="text-lg text-gray-500 tracking-wide mb-1">
            {subtitle}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-snug">
            {description}
          </p>
        )}

        {/* Event metadata — date and location */}
        {(eventDate || event?.location) && (
          <div className="flex justify-center flex-wrap gap-4 mt-3 text-sm text-gray-400 font-medium">
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

        {children}
      </div>
    </div>
  );
}