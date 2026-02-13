/**
 * MyProgramStandby — MyProgram Step 8
 * 
 * Standby screen shown when no program is detected.
 * Light theme per Decision: "MyProgram + TV Display: switch to light theme"
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';

export default function MyProgramStandby() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1F8A70] to-[#4DC15F] flex items-center justify-center mb-6">
        <Calendar className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 uppercase mb-2">{t('myprogram.standby.title')}</h2>
      <p className="text-gray-500 text-sm max-w-sm">{t('myprogram.standby.subtitle')}</p>
      <p className="text-gray-400 text-xs mt-4">{t('myprogram.standby.checkBack')}</p>
    </div>
  );
}