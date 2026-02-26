/**
 * DayServiceHeader — Per-day toolbar for recurring service editor.
 * 
 * Recurring Services Refactor (2026-02-23): Extracted from WeeklyServiceManager
 * to avoid duplicating toolbar logic across day tabs.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Download, Settings, Wand2, MoreVertical, ExternalLink, Loader2, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasPermission } from "@/components/utils/permissions";

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

export default function DayServiceHeader({
  dayOfWeek,
  date,
  serviceId,
  updatedDate,
  isSaving,
  user,
  onDownloadProgramPDF,
  onDownloadAnnouncementsPDF,
  onShowPrintSettings,
  onShowScheduleManager,
  onShowResetConfirm,
}) {
  const navigate = useNavigate();
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  const greenStyle = { backgroundColor: '#8DC63F', color: '#ffffff' };
  const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;

  return (
    <div className="flex justify-between items-start print:hidden">
      <div>
        <h1 className="text-5xl text-gray-900 uppercase tracking-tight">Servicios Semanales</h1>
        <p className="text-gray-500 mt-1">{dayLabel} — Servicios recurrentes</p>
        {serviceId && (
          <span className="text-xs text-gray-400 font-mono mt-1 block">ID: {serviceId}</span>
        )}
        <div className="flex items-center gap-3 mt-2">
          {updatedDate && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
              Última actualización: {new Date(updatedDate).toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Badge>
          )}
          {isSaving && <Badge className="text-xs bg-yellow-500 text-white animate-pulse">Guardando...</Badge>}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Button onClick={() => navigate(createPageUrl('PublicProgramView') + `?date=${date}`)} variant="outline" className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white border-2 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2">
          <Eye className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">Live View</span>
        </Button>
        <Button onClick={onDownloadProgramPDF} style={tealStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Programa">
          <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Programa</span>
        </Button>
        <Button onClick={onDownloadAnnouncementsPDF} style={greenStyle} className="font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2" title="Descargar PDF Anuncios">
          <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-2" /><span className="hidden md:inline">PDF Anuncios</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-100 h-9 w-9">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem 
              onClick={() => {
                // DECISION-005: Open the public speaker submission form.
                // Uses /functions/ (production canonical path).
                // The form itself derives its own production base URL from req.url
                // for any downstream fetch calls, so no window.location dependency.
                window.open('/functions/serveWeeklyServiceSubmission', '_blank');
              }} 
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4 text-purple-500" />
              <span>Link para Oradores</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowPrintSettings} className="gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Ajustes de Impresión</span>
            </DropdownMenuItem>
            {hasPermission(user, 'edit_services') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onShowScheduleManager} className="gap-2">
                  <Wrench className="w-4 h-4 text-purple-500" />
                  <span>Configurar Horarios</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onShowResetConfirm} className="gap-2 text-red-600 focus:text-red-600">
                  <Wand2 className="w-4 h-4" />
                  <span>Restablecer Blueprint</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}