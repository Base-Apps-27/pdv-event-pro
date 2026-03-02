/**
 * ErrorCard — P3 GRO-3 (2026-03-02)
 * 
 * Bilingual error card with retry button for graceful error recovery.
 * Replaces raw red error boxes across public forms and display pages.
 * 
 * Props:
 *   message  — custom error message (optional, defaults to bilingual generic)
 *   onRetry  — callback for retry button (optional, hides button if absent)
 *   language — 'es' | 'en' (optional, defaults to 'es')
 * 
 * Applied to: PublicSpeakerForm, PublicWeeklyForm, PublicArtsForm, MyProgram, PublicProgramView
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MESSAGES = {
  es: {
    title: 'Algo salió mal',
    body: 'No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.',
    retry: 'Reintentar',
  },
  en: {
    title: 'Something went wrong',
    body: 'Could not load the information. Check your connection and try again.',
    retry: 'Retry',
  },
};

export default function ErrorCard({ message, onRetry, language = 'es' }) {
  const t = MESSAGES[language] || MESSAGES.es;

  return (
    <div className="bg-white border border-red-200 rounded-lg p-6 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{t.title}</h3>
      <p className="text-gray-500 text-sm mb-4">
        {message || t.body}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-[#1F8A70] text-[#1F8A70] hover:bg-[#1F8A70] hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t.retry}
        </Button>
      )}
    </div>
  );
}