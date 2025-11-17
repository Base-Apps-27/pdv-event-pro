import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Printer, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DetailedProgram() {
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
      .filter(seg => seg.session_id === sessionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const sessionColorClasses = {
    green: 'border-l-8 border-pdv-green',
    blue: 'border-l-8 border-blue-500',
    pink: 'border-l-8 border-pink-500',
    orange: 'border-l-8 border-orange-500',
    yellow: 'border-l-8 border-pdv-yellow',
    purple: 'border-l-8 border-purple-500',
    red: 'border-l-8 border-red-500',
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-detailed-program');
    const printWindow = window.open('', '', 'width=1200,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Programa Detallado - ${selectedEvent?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
            .event-header { text-align: center; border: 2px solid #1F8A70; padding: 15px; margin-bottom: 20px; }
            .event-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .session-header { background-color: #e3f2fd; padding: 10px; border: 2px solid #000; margin-top: 20px; }
            .session-header.green { border-left: 10px solid #8DC63F; }
            .session-header.blue { border-left: 10px solid #2196F3; }
            .session-header.pink { border-left: 10px solid #E91E63; }
            .team-info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 10px; margin-top: 10px; }
            .team-row { padding: 3px 8px; }
            .team-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f5f5f5; font-weight: bold; font-size: 10px; }
            .time-col { width: 80px; font-weight: bold; text-align: center; }
            .duration-col { width: 80px; text-align: center; }
            .stage-time-col { width: 80px; text-align: center; font-style: italic; }
            .segment-title { font-weight: bold; font-size: 11px; }
            .instructions { font-style: italic; color: #555; font-size: 10px; margin-top: 3px; }
            .mic-assignments { margin-top: 15px; border: 1px solid #000; padding: 10px; }
            .mic-row { margin: 3px 0; }
            @media print {
              .no-print { display: none; }
              @page { size: landscape; margin: 15mm; }
            }
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
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Programa Detallado</h1>
          <p className="text-slate-400 mt-1">Hoja maestra completa con todos los detalles</p>
        </div>
        <Button 
          onClick={handlePrint}
          disabled={!selectedEventId}
          className="gradient-pdv text-white font-bold uppercase"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir/PDF
        </Button>
      </div>

      <Card className="bg-pdv-card border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Filter className="w-5 h-5" />
            Seleccionar Evento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full max-w-md bg-pdv-charcoal border-slate-700 text-white">
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
        <div id="printable-detailed-program" className="bg-pdv-card p-8 rounded-lg">
          <div className="event-header text-center border-4 border-pdv-teal p-6 mb-8 rounded">
            <div className="text-3xl font-bold text-white mb-2 uppercase tracking-tight">
              PROGRAMA: {selectedEvent.name}
            </div>
            {selectedEvent.theme && (
              <div className="text-xl text-pdv-green italic">"{selectedEvent.theme}"</div>
            )}
            {selectedEvent.start_date && (
              <div className="text-slate-400 mt-2">
                {selectedEvent.start_date} {selectedEvent.end_date && `- ${selectedEvent.end_date}`}
              </div>
            )}
            {selectedEvent.location && (
              <div className="text-slate-400">{selectedEvent.location}</div>
            )}
          </div>

          {eventSessions.map((session) => {
            const segments = getSessionSegments(session.id);
            if (segments.length === 0) return null;

            return (
              <div key={session.id} className={`mb-10 border-2 border-slate-700 rounded-lg overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-3">
                        {session.name}
                      </h2>
                      <div className="text-lg text-slate-300">
                        {session.date} • {session.planned_start_time || "Por definir"}
                        {session.location && ` • ${session.location}`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                    {session.admin_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-orange-400 font-bold uppercase">ADMIN:</span>
                        <span className="text-white ml-2">{session.admin_team}</span>
                      </div>
                    )}
                    {session.coordinators && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-orange-400 font-bold uppercase">COORDINADORES:</span>
                        <span className="text-white ml-2">{session.coordinators}</span>
                      </div>
                    )}
                    {session.sound_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-red-400 font-bold uppercase">SONIDO:</span>
                        <span className="text-white ml-2">{session.sound_team}</span>
                      </div>
                    )}
                    {session.tech_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-red-400 font-bold uppercase">EQUIPO TÉCNICO:</span>
                        <span className="text-white ml-2">{session.tech_team}</span>
                      </div>
                    )}
                    {session.ushers_lead && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-red-400 font-bold uppercase">UJIER A CARGO:</span>
                        <span className="text-white ml-2">{session.ushers_lead}</span>
                      </div>
                    )}
                    {session.translation_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-slate-400 font-bold uppercase">TRADUCCIÓN:</span>
                        <span className="text-white ml-2">{session.translation_team}</span>
                      </div>
                    )}
                    {session.hospitality_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-slate-400 font-bold uppercase">HOSPITALIDAD:</span>
                        <span className="text-white ml-2">{session.hospitality_team}</span>
                      </div>
                    )}
                    {session.photography_team && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-slate-400 font-bold uppercase">FOTOGRAFÍA:</span>
                        <span className="text-white ml-2">{session.photography_team}</span>
                      </div>
                    )}
                    {session.worship_leader && (
                      <div className="bg-slate-900 bg-opacity-50 p-3 rounded">
                        <span className="text-slate-400 font-bold uppercase">LÍDER ALABANZA:</span>
                        <span className="text-white ml-2">{session.worship_leader}</span>
                      </div>
                    )}
                  </div>

                  {session.notes && (
                    <div className="mt-4 bg-blue-900 bg-opacity-30 p-3 rounded border border-blue-700">
                      <span className="text-blue-400 font-bold uppercase">NOTAS GENERALES:</span>
                      <div className="text-slate-300 mt-1">{session.notes}</div>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="p-3 text-white font-bold uppercase w-24 text-center">Hora</th>
                        <th className="p-3 text-white font-bold uppercase">Detalles</th>
                        <th className="p-3 text-white font-bold uppercase w-24 text-center">Duración</th>
                        <th className="p-3 text-white font-bold uppercase w-28 text-center">Hora en Escenario</th>
                        <th className="p-3 text-white font-bold uppercase w-64">Proyección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((segment, idx) => (
                        <tr key={segment.id} className={idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}>
                          <td className="p-3 text-pdv-green font-bold text-center text-lg border-slate-700">
                            {segment.start_time || "-"}
                          </td>
                          <td className="p-3 border-slate-700">
                            <div className="space-y-2">
                              <div className="text-white font-bold text-base uppercase">
                                {segment.title}
                              </div>
                              
                              {segment.segment_type && (
                                <div className="text-pdv-yellow text-xs font-bold uppercase">
                                  {segment.segment_type}
                                </div>
                              )}

                              {segment.speaker_or_team && (
                                <div className="text-blue-400 font-semibold">
                                  {segment.speaker_or_team}
                                </div>
                              )}

                              {segment.description_details && (
                                <div className="text-slate-400 text-sm mt-2">
                                  {segment.description_details}
                                </div>
                              )}

                              {segment.ushers_notes && (
                                <div className="mt-2 text-xs bg-red-900 bg-opacity-30 p-2 rounded border border-red-800">
                                  <span className="text-red-400 font-bold uppercase">UJIERES:</span>
                                  <span className="text-slate-300 ml-2">{segment.ushers_notes}</span>
                                </div>
                              )}

                              {segment.sound_notes && (
                                <div className="mt-2 text-xs bg-purple-900 bg-opacity-30 p-2 rounded border border-purple-800">
                                  <span className="text-purple-400 font-bold uppercase">SONIDO:</span>
                                  <span className="text-slate-300 ml-2">{segment.sound_notes}</span>
                                </div>
                              )}

                              {segment.translation_notes && (
                                <div className="mt-2 text-xs bg-blue-900 bg-opacity-30 p-2 rounded border border-blue-800">
                                  <span className="text-blue-400 font-bold uppercase">TRADUCCIÓN:</span>
                                  <span className="text-slate-300 ml-2">{segment.translation_notes}</span>
                                </div>
                              )}

                              {segment.microphone_assignments && (
                                <div className="mt-2 text-xs bg-yellow-900 bg-opacity-20 p-2 rounded border border-yellow-800">
                                  <span className="text-yellow-400 font-bold uppercase">MICRÓFONOS:</span>
                                  <div className="text-slate-300 mt-1 whitespace-pre-line">{segment.microphone_assignments}</div>
                                </div>
                              )}

                              {segment.songs_list && (
                                <div className="mt-2 text-xs bg-green-900 bg-opacity-20 p-2 rounded border border-green-800">
                                  <span className="text-green-400 font-bold uppercase">CANCIONES:</span>
                                  <div className="text-slate-300 mt-1 whitespace-pre-line">{segment.songs_list}</div>
                                </div>
                              )}

                              {segment.other_notes && (
                                <div className="mt-2 text-xs bg-slate-700 p-2 rounded">
                                  <span className="text-slate-400 font-bold uppercase">NOTAS:</span>
                                  <span className="text-slate-300 ml-2">{segment.other_notes}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center text-pdv-green font-bold border-slate-700">
                            {segment.duration_min ? `${segment.duration_min} min` : "-"}
                          </td>
                          <td className="p-3 text-center text-blue-400 font-mono font-semibold border-slate-700">
                            {segment.stage_call_time || "-"}
                          </td>
                          <td className="p-3 text-slate-400 text-xs border-slate-700">
                            {segment.projection_notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {eventSessions.length === 0 && (
            <div className="text-center text-slate-500 py-12">
              Este evento no tiene sesiones programadas.
            </div>
          )}
        </div>
      )}

      {!selectedEventId && (
        <Card className="p-12 text-center border-dashed border-2 bg-pdv-card border-slate-700">
          <Filter className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Selecciona un evento para ver el programa detallado</p>
        </Card>
      )}
    </div>
  );
}