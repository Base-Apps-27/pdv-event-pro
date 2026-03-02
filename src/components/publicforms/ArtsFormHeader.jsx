/**
 * ArtsFormHeader.jsx
 * 
 * P3 UX-1 (2026-03-02): Refactored to use PublicFormShell for consistent branding.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import PublicFormShell from './PublicFormShell';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsFormHeader({ event }) {
    const { t } = usePublicLang();

    return (
        <PublicFormShell
            title={t('ENTREGA DE MATERIAL ARTÍSTICO', 'ARTS MATERIAL SUBMISSION')}
            subtitle={event?.name || t('Evento', 'Event')}
            description={t(
                'Suba archivos finales listos para instalar: canciones, videos, documentos de guía.',
                'Upload final, ready-to-install files: songs, videos, run-of-show documents.'
            )}
            event={event}
        />
    );
}