/**
 * WeeklyFormHeader.jsx
 * 
 * Header component for the public weekly service submission form.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';
import { usePublicLang } from './PublicFormLangContext';

export default function WeeklyFormHeader() {
    const { t } = usePublicLang();
    return (
        <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="h-1.5 brand-gradient" />
            <div className="pt-8 pb-6 px-6 md:px-8 text-center">
                <p className="text-[10px] font-extrabold text-pdv-teal uppercase tracking-[0.2em] mb-1">
                    PALABRAS DE VIDA
                </p>
                <h1 className="text-4xl text-[#1A1A1A] mb-2 leading-none">
                    {t('MATERIAL: MENSAJE SEMANAL', 'MATERIAL: WEEKLY MESSAGE')}
                </h1>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                    {t('Entregue versículos y material final para proyección', 'Submit verses and final material for projection')}
                </p>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-snug">
                    {t('Solo archivos terminados y listos para instalar.', 'Final, ready-to-install files only.')}
                </p>
            </div>
        </div>
    );
}