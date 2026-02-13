/**
 * PostSessionBanner — MyProgram Step 8
 * 
 * Displayed at the bottom of the timeline when all segments are complete.
 * Provides closure to the session view.
 */
import React from 'react';
import { CheckCircle2, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';

export default function PostSessionBanner({ isFinished, nextSessionTime }) {
  const { t } = useLanguage();

  if (!isFinished) return null;

  return (
    <div className="mt-8 mb-12 text-center p-6 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <CheckCircle2 className="w-6 h-6 text-green-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">
        {t('myprogram.sessionEnded') || 'Session Finalized'}
      </h3>
      <p className="text-gray-500 text-sm">
        {t('myprogram.thankYou') || 'Thank you for serving today!'}
      </p>

      {nextSessionTime && (
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-700">
            Next Session: {nextSessionTime}
          </span>
        </div>
      )}
    </div>
  );
}