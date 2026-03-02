/**
 * WeeklyFormHeader.jsx
 * 
 * P3 UX-1 (2026-03-02): Refactored to use PublicFormShell for consistent branding.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import PublicFormShell from './PublicFormShell';
import { usePublicLang } from './PublicFormLangContext';

export default function WeeklyFormHeader() {
    const { t } = usePublicLang();

    return (
        <PublicFormShell
            title={t('MATERIAL: MENSAJE SEMANAL', 'MATERIAL: WEEKLY MESSAGE')}
            description={t(
                'Entregue versículos y material final para proyección. Solo archivos terminados y listos para instalar.',
                'Submit verses and final material for projection. Final, ready-to-install files only.'
            )}
        />
    );
}