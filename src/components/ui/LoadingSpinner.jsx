/**
 * LoadingSpinner — P3 UX-2 (2026-03-02)
 * 
 * Unified loading spinner component replacing 4+ inconsistent spinner patterns.
 * Uses brand teal color and Loader2 icon from lucide-react.
 * 
 * Variants:
 *   sm    — inline, 20px (inside buttons, badges)
 *   md    — section-level, 32px (default)
 *   lg    — page-level, 48px (full sections)
 *   fullPage — centered in viewport with optional label
 * 
 * Surfaces replaced:
 *   - MyProgram (Loader2 spinner)
 *   - PublicSpeakerForm (CSS border spinner)
 *   - PublicWeeklyForm (CSS border spinner)
 *   - PublicArtsForm (CSS border spinner)
 *   - MessageProcessing (Loader2 spinner)
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function LoadingSpinner({ size = 'md', label, className = '' }) {
  const sizeClass = SIZES[size] || SIZES.md;

  // Full-page variant: centered in viewport with label
  if (size === 'fullPage') {
    return (
      <div className="min-h-screen bg-[#F0F1F3] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1F8A70]" />
          {label && <p className="text-gray-500 text-sm font-medium">{label}</p>}
        </div>
      </div>
    );
  }

  return (
    <Loader2 className={`animate-spin text-[#1F8A70] ${sizeClass} ${className}`} />
  );
}