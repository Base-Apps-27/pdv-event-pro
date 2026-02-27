/**
 * WeeklyFormHeader.jsx
 * 
 * Header component for the public weekly service submission form.
 * CSP Migration (2026-02-27): Part of the move from SSR HTML to React pages.
 */
import React from 'react';

export default function WeeklyFormHeader() {
    return (
        <div className="relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F]" />
            <div className="pt-10 pb-8 px-8 text-center border-b border-gray-200">
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