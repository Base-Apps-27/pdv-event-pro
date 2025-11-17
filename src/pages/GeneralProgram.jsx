import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Printer, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function GeneralProgram() {
  const [selectedEventId, setSelectedEventId] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-year'),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.Session.list(),
  });

  const { data: allSegments = [] } = useQuery({
    queryKey: ['segments'],
    queryFn: () => base44.entities.Segment.list(),
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventSessions = sessions.filter(s => s.event_id === selectedEventId).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const getSessionSegments = (sessionId) => {
    return allSegments
      .filter(seg => seg.session_id === sessionId && seg.show_in_general)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const handleExport = () => {
    const printContent = document.getElementById('printable-program');
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Programa General - ${selectedEvent?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #1e293b; }
            h2 { color: #475569; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .session-header { background-color: #dbeafe; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportCSV = () => {
    let csvContent = "Sesión,Hora,Título,Responsable,Duración (min),Detalles,Hora en Escenario\n";
    
    eventSessions.forEach(session => {
      const segments = getSessionSegments(session.id);
      segments.forEach(segment => {
        const row = [
          session.name,
          segment.start_time || "",
          segment.title,
          segment.speaker_or_team || "",
          segment.duration_min || "",
          (segment.description_details || "").replace(/,/g, ";"),
          segment.stage_call_time || ""
        ].map(field => `"${field}"`).join(",");
        csvContent += row + "\n";
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `programa_${selectedEvent?.name || 'evento'}.csv`;
    link.click();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Programa General</h1>
          <p className="text-slate-600 mt-1">Vista completa del evento para impresión</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={!selectedEventId}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Excel/CSV
          </Button>
          <Button 
            onClick={handleExport}
            disabled={!selectedEventId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Seleccionar Evento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecciona un evento..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} - {event.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedEventId && selectedEvent && (
        <div id="printable-program" className="bg-white p-8 rounded-lg shadow-sm">
          <div className="text-center mb-8 border-b-2 border-slate-200 pb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedEvent.name}</h1>
            {selectedEvent.theme && (
              <p className="text-xl text-slate-600 italic">"{selectedEvent.theme}"</p>
            )}
            {selectedEvent.location && (
              <p className="text-slate-600 mt-2">{selectedEvent.location}</p>
            )}
            {selectedEvent.start_date && (
              <p className="text-slate-500">{selectedEvent.start_date} {selectedEvent.end_date && `- ${selectedEvent.end_date}`}</p>
            )}
          </div>

          {eventSessions.map((session) => {
            const segments = getSessionSegments(session.id);
            if (segments.length === 0) return null;

            return (
              <div key={session.id} className="mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4">
                  <h2 className="text-2xl font-bold text-slate-900">{session.name}</h2>
                  <p className="text-slate-600">
                    {session.date} • {session.planned_start_time || "Por definir"}
                    {session.location && ` • ${session.location}`}
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-24">Hora</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="w-24">Duración</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead className="w-24">Llamado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segments.map((segment) => (
                      <TableRow key={segment.id}>
                        <TableCell className="font-mono font-medium">{segment.start_time || "-"}</TableCell>
                        <TableCell className="font-semibold">{segment.title}</TableCell>
                        <TableCell className="text-slate-600">{segment.speaker_or_team || "-"}</TableCell>
                        <TableCell>{segment.duration_min ? `${segment.duration_min} min` : "-"}</TableCell>
                        <TableCell className="text-sm text-slate-600">{segment.description_details || "-"}</TableCell>
                        <TableCell className="font-mono text-sm text-blue-600">{segment.stage_call_time || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          {eventSessions.length === 0 && (
            <p className="text-center text-slate-500 py-12">Este evento no tiene sesiones programadas.</p>
          )}
        </div>
      )}

      {!selectedEventId && (
        <Card className="p-12 text-center border-dashed border-2">
          <Filter className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">Selecciona un evento para ver el programa general</p>
        </Card>
      )}
    </div>
  );
}