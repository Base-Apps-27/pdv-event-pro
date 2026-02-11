import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, FileText, Megaphone, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function EventInfo({ event }) {
  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200"
  };

  const statusLabels = {
    planning: "En Planificación",
    confirmed: "Confirmado",
    in_progress: "En Curso",
    completed: "Completado",
    archived: "Archivado"
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-gray-50 border-b border-gray-100">
        <CardTitle className="text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-6 rounded-full" style={{ backgroundColor: '#8DC63F' }} />
            Información del Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Duplicate actions removed — available in header */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Estado</p>
            <Badge className={`${statusColors[event.status]} border`}>
              {statusLabels[event.status]}
            </Badge>
          </div>

          <div>
            <p className="text-sm text-slate-500 mb-1">Año</p>
            <p className="text-lg font-semibold text-slate-900">{event.year}</p>
          </div>
        </div>

        {event.location && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Ubicación</p>
              <p className="text-lg font-medium text-slate-900">{event.location}</p>
            </div>
          </div>
        )}

        {(event.start_date || event.end_date) && (
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Fechas</p>
              <p className="text-lg font-medium text-slate-900">
                {event.start_date && format(new Date(event.start_date), "d 'de' MMMM", { locale: es })}
                {event.end_date && ` - ${format(new Date(event.end_date), "d 'de' MMMM, yyyy", { locale: es })}`}
              </p>
            </div>
          </div>
        )}

        {event.description && (
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Descripción</p>
              <p className="text-slate-900 mt-1">{event.description}</p>
            </div>
          </div>
        )}

        {event.promote_in_announcements && (
          <div className="flex items-start gap-3 pt-4 border-t border-gray-100">
            <Megaphone className="w-5 h-5 mt-0.5" style={{ color: '#1F8A70' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: '#1F8A70' }}>Promoción Activa</p>
              <p className="text-slate-600 mt-1 text-sm">
                {event.announcement_blurb || "Sin texto definido"}
              </p>
              <div className="flex gap-2 mt-2 text-xs text-slate-500">
                 {event.promotion_start_date && <span>Desde: {format(new Date(event.promotion_start_date), "d MMM", { locale: es })}</span>}
                 {event.promotion_end_date && <span>Hasta: {format(new Date(event.promotion_end_date), "d MMM", { locale: es })}</span>}
              </div>
              {event.promotion_targets && event.promotion_targets.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {event.promotion_targets.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}