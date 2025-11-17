import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Users, Printer, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function UshersView() {
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
      .filter(seg => seg.session_id === sessionId && seg.show_in_ushers)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-ushers');
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Vista Ujieres - ${selectedEvent?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #1e293b; }
            h2 { color: #475569; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background-color: #fef3c7; font-weight: bold; }
            .notes { background-color: #fef3c7; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Vista Ujieres</h1>
            <p className="text-slate-600">Instrucciones para equipo de hospitalidad</p>
          </div>
        </div>
        <Button 
          onClick={handlePrint}
          disabled={!selectedEventId}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
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
        <div id="printable-ushers" className="bg-white p-8 rounded-lg shadow-sm">
          <div className="text-center mb-8 border-b-2 border-amber-200 pb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Users className="w-8 h-8 text-amber-600" />
              <h1 className="text-3xl font-bold text-slate-900">VISTA UJIERES</h1>
            </div>
            <h2 className="text-2xl font-semibold text-slate-700">{selectedEvent.name}</h2>
            {selectedEvent.theme && (
              <p className="text-lg text-slate-600 italic mt-1">"{selectedEvent.theme}"</p>
            )}
          </div>

          {eventSessions.map((session) => {
            const segments = getSessionSegments(session.id);
            if (segments.length === 0) return null;

            return (
              <div key={session.id} className="mb-8 break-inside-avoid">
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-lg mb-4">
                  <h3 className="text-xl font-bold text-slate-900">{session.name}</h3>
                  <p className="text-slate-600">{session.date} • {session.planned_start_time || "Por definir"}</p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50">
                      <TableHead className="w-24">Hora</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Notas Ujieres</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segments.map((segment) => (
                      <TableRow key={segment.id} className={segment.ushers_notes ? "bg-yellow-50" : ""}>
                        <TableCell className="font-mono font-medium">{segment.start_time || "-"}</TableCell>
                        <TableCell className="font-semibold">{segment.title}</TableCell>
                        <TableCell className="text-sm text-slate-600">{segment.description_details || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {segment.ushers_notes || (
                            <span className="text-slate-400 italic">Sin notas específicas</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      {!selectedEventId && (
        <Card className="p-12 text-center border-dashed border-2">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">Selecciona un evento para ver las instrucciones para ujieres</p>
        </Card>
      )}
    </div>
  );
}