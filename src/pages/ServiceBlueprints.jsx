/**
 * ServiceBlueprints page — now hosts the ServiceScheduleManager.
 * Phase 1 Entity Lift: Admin UI for managing recurring service schedules.
 */

import React from "react";
import { useLanguage } from "@/components/utils/i18n";
import ServiceScheduleManager from "@/components/service/weekly/ServiceScheduleManager";

import BlueprintManager from "@/components/service/weekly/BlueprintManager";

export default function ServiceBlueprints() {
  const { language } = useLanguage();
  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      <div className="bg-gradient-to-r from-[#1F8A70] via-[#4DC15F] to-[#D9DF32] px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl uppercase text-white mb-1">
            {language === 'es' ? 'Configuración de Servicios' : 'Service Configuration'}
          </h1>
          <p className="text-white/90">
            {language === 'es'
              ? 'Configura los días, horarios y plantillas de tus servicios recurrentes'
              : 'Configure days, schedules, and templates for your recurring services'}
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        <ServiceScheduleManager />
        <div className="border-t border-gray-300 pt-8">
          <BlueprintManager />
        </div>
      </div>
    </div>
  );
}