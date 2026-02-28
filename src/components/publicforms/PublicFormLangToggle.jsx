/**
 * PublicFormLangToggle.jsx
 * 
 * Top-right ES | EN language toggle for public forms.
 * Matches the design shown in the reference screenshot (PDV Student Portal).
 * Positioned absolute top-right of the page container.
 * 
 * 2026-02-28: Created as part of bilingual toggle refactor.
 */
import React from 'react';
import { usePublicLang } from './PublicFormLangContext';

export default function PublicFormLangToggle() {
  const { lang, setLang } = usePublicLang();

  return (
    <div className="flex items-center gap-1 text-sm font-medium select-none">
      <button
        type="button"
        onClick={() => setLang('es')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          lang === 'es' ? 'text-gray-900 font-bold' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        ES
      </button>
      <span className="text-gray-300">|</span>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          lang === 'en' ? 'text-gray-900 font-bold' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        EN
      </button>
    </div>
  );
}