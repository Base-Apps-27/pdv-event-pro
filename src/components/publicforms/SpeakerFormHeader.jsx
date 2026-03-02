/**
 * SpeakerFormHeader.jsx
 * 
 * P3 UX-1 (2026-03-02): Refactored to use PublicFormShell for consistent branding.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import PublicFormShell from './PublicFormShell';
import { usePublicLang } from './PublicFormLangContext';

export default function SpeakerFormHeader({ event }) {
    const { t } = usePublicLang();

    return (
        <PublicFormShell
            title={t('MATERIAL DE SU MENSAJE', 'YOUR MESSAGE MATERIAL')}
            subtitle={event?.name || t('Evento', 'Event')}
            description={t('Entregue versículos y material final listo para proyección.', 'Submit verses and final presentation-ready material.')}
            event={event}
        />
    );
}