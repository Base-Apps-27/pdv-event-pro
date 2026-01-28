import React from "react";
import { useLanguage } from "@/components/utils/i18n";

export default function Home() {
  const { t } = useLanguage();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-bold uppercase tracking-tight brand-gradient-text">{t('dashboard.title')}</h1>
        <p className="text-gray-600">{t('dashboard.subtitle')}</p>
      </div>
    </div>
  );
}