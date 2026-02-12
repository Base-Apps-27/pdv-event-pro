import React from "react";
import { useLanguage } from "@/components/utils/i18n";
import { Construction } from "lucide-react";

export default function ServiceDetail() {
  const { language } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <Construction className="w-16 h-16 text-gray-300 mb-4" />
      <h2 className="text-2xl font-bold text-gray-400 mb-2">
        {language === 'es' ? 'Próximamente' : 'Coming Soon'}
      </h2>
      <p className="text-gray-400 max-w-md">
        {language === 'es'
          ? 'Esta página está en desarrollo. Pronto estará disponible.'
          : 'This page is under development. It will be available soon.'}
      </p>
    </div>
  );
}
