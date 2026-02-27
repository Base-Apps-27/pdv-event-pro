/**
 * WeeklyFormHeader.jsx
 * 
 * Header component for the public weekly service submission form.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';

export default function WeeklyFormHeader() {
    return (
        <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="h-1.5 brand-gradient" />
            <div className="pt-8 pb-6 px-6 md:px-8 text-center">
                <p className="text-[10px] font-extrabold text-pdv-teal uppercase tracking-[0.2em] mb-1">
                    PALABRAS DE VIDA
                </p>
                <h1 className="text-4xl text-[#1A1A1A] mb-2 leading-none">
                    VERSÍCULOS - MENSAJE SEMANAL
                </h1>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Envíe sus notas para extracción de versículos
                </p>
            </div>
        </div>
    );
}