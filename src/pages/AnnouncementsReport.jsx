import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Printer, Share2, FileText, Search, Filter, Megaphone, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AnnouncementsReport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTone, setFilterTone] = useState("all");

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      // Fetch all segments of type 'Anuncio'
      const segments = await base44.entities.Segment.filter({ segment_type: 'Anuncio' });
      
      // Enrich with session info to get dates/context
      const sessions = await base44.entities.Session.list();
      const sessionMap = sessions.reduce((acc, session) => {
        acc[session.id] = session;
        return acc;
      }, {});

      // Enrich with service/event info
      const events = await base44.entities.Event.list();
      const services = await base44.entities.Service.list();
      const eventMap = events.reduce((acc, e) => ({...acc, [e.id]: e}), {});
      const serviceMap = services.reduce((acc, s) => ({...acc, [s.id]: s}), {});

      return segments.map(segment => {
        const session = sessionMap[segment.session_id];
        let contextName = "Desconocido";
        let date = "";

        if (session) {
          date = session.date;
          if (session.event_id && eventMap[session.event_id]) {
            contextName = eventMap[session.event_id].name;
          } else if (session.service_id && serviceMap[session.service_id]) {
            contextName = serviceMap[session.service_id].name;
          } else {
            contextName = session.name;
          }
        }

        return {
          ...segment,
          session_date: date,
          context_name: contextName,
          session_name: session?.name
        };
      }).sort((a, b) => new Date(b.session_date || 0) - new Date(a.session_date || 0));
    }
  });

  const filteredAnnouncements = announcements.filter(item => {
    const matchesSearch = 
      (item.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (item.announcement_title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (item.announcement_description?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesTone = filterTone === "all" || item.announcement_tone === filterTone;

    return matchesSearch && matchesTone;
  });

  const handlePrint = () => {
    window.print();
  };

  const uniqueTones = [...new Set(announcements.map(a => a.announcement_tone).filter(Boolean))];

  return (
    <div className="p-6 md:p-8 space-y-6 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Reporte de Anuncios
          </h1>
          <p className="text-gray-500 mt-1">Historial y planificación de anuncios para servicios y eventos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filters - Hide on print */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar anuncios..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={filterTone} onValueChange={setFilterTone}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por Tono" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Tonos</SelectItem>
              {uniqueTones.map(tone => (
                <SelectItem key={tone} value={tone}>{tone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Content */}
      <div className="space-y-8 print:space-y-6">
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No se encontraron anuncios con los filtros actuales.</p>
          </div>
        ) : (
          <div className="grid gap-6 print:block print:gap-0">
            {filteredAnnouncements.map((item) => (
              <Card key={item.id} className="break-inside-avoid print:mb-6 print:shadow-none print:border-gray-300">
                <CardHeader className="pb-3 bg-gray-50/50 border-b border-gray-100 print:bg-transparent print:border-gray-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-white">
                          {item.context_name}
                        </Badge>
                        <span className="text-xs text-gray-500 font-medium">
                          {item.session_date && format(new Date(item.session_date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                        </span>
                      </div>
                      <CardTitle className="text-xl font-bold text-pdv-teal">
                        {item.announcement_title || item.title}
                      </CardTitle>
                    </div>
                    {item.announcement_tone && (
                      <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200">
                        Tono: {item.announcement_tone}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase mb-1">Script / Descripción</h4>
                      <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed p-3 bg-gray-50 rounded border border-gray-100 print:bg-transparent print:border-none print:p-0">
                        {item.announcement_description || item.description_details || "Sin descripción detallada."}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 border-l pl-6 border-gray-100 print:border-gray-300">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Presentador</h4>
                      <p className="font-medium text-sm">{item.presenter || "Sin asignar"}</p>
                    </div>
                    
                    {item.announcement_date && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Fecha Relevante</h4>
                        <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {format(new Date(item.announcement_date), "d MMM yyyy", { locale: es })}
                        </div>
                      </div>
                    )}

                    {item.video_name && (
                      <div>
                         <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Recurso Visual</h4>
                         <div className="flex items-center gap-1 text-sm text-blue-600">
                           <FileText className="w-3.5 h-3.5" />
                           {item.video_name}
                         </div>
                      </div>
                    )}

                    {item.projection_notes && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notas de Pantalla</h4>
                        <p className="text-xs text-gray-600 italic">{item.projection_notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}