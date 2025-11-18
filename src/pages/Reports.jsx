import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer, Filter, Projector, Volume2, Users as UsersIcon, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatTimeToEST } from "@/utils/timeFormat";

export default function Reports() {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeReport, setActiveReport] = useState("detailed");

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

  const { data: allActions = [] } = useQuery({
    queryKey: ['segmentActions'],
    queryFn: () => base44.entities.SegmentAction.list(),
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventSessions = sessions.filter(s => s.event_id === selectedEventId).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const getSessionSegments = (sessionId, filterKey) => {
    return allSegments
      .filter(seg => seg.session_id === sessionId && (filterKey ? seg[filterKey] : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const sessionColorClasses = {
    green: 'border-l-8 border-pdv-green',
    blue: 'border-l-8 border-blue-500',
    pink: 'border-l-8 border-pink-500',
    orange: 'border-l-8 border-orange-500',
    yellow: 'border-l-8 border-yellow-400',
    purple: 'border-l-8 border-purple-500',
    red: 'border-l-8 border-red-500',
  };

  const handlePrint = () => {
    window.print();
  };

  const getSegmentActions = (segmentId) => {
    return allActions
      .filter(action => action.segment_id === segmentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const departmentColors = {
    Admin: "bg-orange-50 border-orange-200 text-orange-700",
    MC: "bg-blue-50 border-blue-200 text-blue-700",
    Sound: "bg-red-50 border-red-200 text-red-700",
    Projection: "bg-purple-50 border-purple-200 text-purple-700",
    Hospitality: "bg-pink-50 border-pink-200 text-pink-700",
    Ujieres: "bg-green-50 border-green-200 text-green-700",
    Kids: "bg-yellow-50 border-yellow-200 text-yellow-700",
    Other: "bg-gray-50 border-gray-200 text-gray-700"
  };

  const renderDetailedProgram = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id);
        if (segments.length === 0) return null;

        return (
          <div key={session.id} className={`border-2 border-gray-200 rounded-lg overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tight mb-3">
                    {session.name}
                  </h2>
                  <div className="text-lg text-gray-700">
                    {session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}
                    {session.location && ` • ${session.location}`}
                    {session.default_stage_call_offset_min && (
                      <span className="ml-2 text-blue-600 font-semibold">
                        • Llegada de los Equipos: {session.default_stage_call_offset_min} min antes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                {session.admin_team && (
                  <div className="bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                    <span className="text-orange-600 font-bold uppercase">ADMIN:</span>
                    <span className="text-gray-800 ml-2">{session.admin_team}</span>
                  </div>
                )}
                {session.sound_team && (
                  <div className="bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                    <span className="text-red-600 font-bold uppercase">SONIDO:</span>
                    <span className="text-gray-800 ml-2">{session.sound_team}</span>
                  </div>
                )}
                {session.tech_team && (
                  <div className="bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                    <span className="text-purple-600 font-bold uppercase">TÉCNICO:</span>
                    <span className="text-gray-800 ml-2">{session.tech_team}</span>
                  </div>
                )}
                {session.ushers_lead && (
                  <div className="bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                    <span className="text-blue-600 font-bold uppercase">UJIER:</span>
                    <span className="text-gray-800 ml-2">{session.ushers_lead}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="p-3 text-gray-900 font-bold uppercase w-24 text-center">Hora</th>
                    <th className="p-3 text-gray-900 font-bold uppercase">Detalles</th>
                    <th className="p-3 text-gray-900 font-bold uppercase w-24 text-center">Duración</th>
                    <th className="p-3 text-gray-900 font-bold uppercase w-64">Proyección</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((segment, idx) => (
                    <tr key={segment.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 text-pdv-green font-bold text-center text-lg border-r border-gray-200">
                        {segment.start_time ? formatTimeToEST(segment.start_time) : "-"}
                      </td>
                      <td className="p-3 border-r border-gray-200">
                        <div className="space-y-2">
                          <div className="text-gray-900 font-bold text-base uppercase">
                            {segment.title}
                          </div>
                          
                          {segment.segment_type && (
                            <Badge variant="outline" className="text-xs">
                              {segment.segment_type}
                            </Badge>
                          )}

                          {segment.presenter && (
                            <div className="text-blue-600 font-semibold">
                              {segment.presenter}
                            </div>
                          )}

                          {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                            <div className="mt-2 text-xs bg-green-50 p-2 rounded border border-green-200">
                              <span className="text-green-700 font-bold uppercase">CANCIONES:</span>
                              <div className="mt-1 space-y-1">
                                {[...Array(segment.number_of_songs)].map((_, idx) => {
                                  const songNum = idx + 1;
                                  const title = segment[`song_${songNum}_title`];
                                  const lead = segment[`song_${songNum}_lead`];
                                  if (!title) return null;
                                  return (
                                    <div key={songNum} className="text-gray-700">
                                      {songNum}. {title} {lead && `(${lead})`}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {segment.segment_type === "Plenaria" && segment.message_title && (
                            <div className="mt-2 text-xs bg-blue-50 p-2 rounded border border-blue-200">
                              <span className="text-blue-700 font-bold uppercase">MENSAJE:</span>
                              <span className="text-gray-700 ml-2">{segment.message_title}</span>
                            </div>
                          )}

                          {segment.segment_type === "Plenaria" && segment.scripture_references && (
                            <div className="mt-2 text-xs bg-amber-50 p-2 rounded border border-amber-200">
                              <span className="text-amber-700 font-bold uppercase">ESCRITURAS:</span>
                              <span className="text-gray-700 ml-2">{segment.scripture_references}</span>
                            </div>
                          )}

                          {segment.requires_translation && segment.translator_name && (
                            <div className="mt-2 text-xs bg-purple-50 p-2 rounded border border-purple-200">
                              <span className="text-purple-700 font-bold uppercase">TRADUCTOR:</span>
                              <span className="text-gray-700 ml-2">{segment.translator_name}</span>
                            </div>
                          )}

                          {segment.description_details && (
                            <div className="text-gray-600 text-sm mt-2">
                              {segment.description_details}
                            </div>
                          )}

                          {segment.sound_notes && (
                            <div className="mt-2 text-xs bg-purple-50 p-2 rounded border border-purple-200">
                              <span className="text-purple-700 font-bold uppercase">SONIDO:</span>
                              <span className="text-gray-700 ml-2">{segment.sound_notes}</span>
                            </div>
                          )}

                          {getSegmentActions(segment.id).length > 0 && (
                            <div className="mt-3 text-xs">
                              <div className="font-bold uppercase text-gray-900 mb-2">ACCIONES:</div>
                              <div className="space-y-1">
                                {getSegmentActions(segment.id).map((action, actionIdx) => (
                                  <div
                                    key={action.id}
                                    className={`p-2 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold">{actionIdx + 1}.</span>
                                      <div className="flex-1">
                                        <div className="font-semibold">
                                          [{action.department}] {action.label}
                                        </div>
                                        {action.time_hint && (
                                          <div className="text-xs italic mt-0.5">
                                            Pista: {action.time_hint}
                                          </div>
                                        )}
                                        {action.details && (
                                          <div className="mt-1">
                                            {action.details}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center text-pdv-green font-bold border-r border-gray-200">
                        {segment.duration_min ? `${segment.duration_min} min` : "-"}
                      </td>
                      <td className="p-3 text-gray-600 text-xs border-gray-200">
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
    </div>
  );

  const renderGeneralProgram = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_general');
        if (segments.length === 0) return null;

        return (
          <div key={session.id}>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border border-blue-200">
              <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time || "Por definir"}</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Responsable</th>
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Duración</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-gray-700">{segment.presenter || "-"}</td>
                    <td className="p-3 text-gray-700">{segment.duration_min ? `${segment.duration_min} min` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );

  const renderProjectionView = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_projection');
        if (segments.length === 0) return null;

        return (
          <div key={session.id}>
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg mb-4 border border-purple-200">
              <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-purple-50 border-b-2 border-purple-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Proyección</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.projection_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-sm text-gray-700">
                      {segment.projection_notes || <span className="italic text-gray-400">Sin notas específicas</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );

  const renderSoundView = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_sound');
        if (segments.length === 0) return null;

        return (
          <div key={session.id}>
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg mb-4 border border-red-200">
              <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-red-50 border-b-2 border-red-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Responsable</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Sonido</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.sound_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-gray-700">{segment.presenter || "-"}</td>
                    <td className="p-3 text-sm text-gray-700">
                      {segment.sound_notes || <span className="italic text-gray-400">Sin notas específicas</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );

  const renderUshersView = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id, 'show_in_ushers');
        if (segments.length === 0) return null;

        return (
          <div key={session.id}>
            <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg mb-4 border border-green-200">
              <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-50 border-b-2 border-green-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Hora</th>
                  <th className="p-3 text-left font-bold text-gray-900">Título</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas Ujieres</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, idx) => (
                  <tr key={segment.id} className={`border-b border-gray-200 ${segment.ushers_notes ? "bg-yellow-50" : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</td>
                    <td className="p-3 font-semibold text-gray-900">{segment.title}</td>
                    <td className="p-3 text-sm text-gray-700">
                      {segment.ushers_notes || <span className="italic text-gray-400">Sin notas específicas</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 uppercase">Informes de Eventos</h1>
            <p className="text-gray-600 mt-1">Visualiza y exporta reportes de eventos</p>
          </div>
          <Button 
            onClick={handlePrint}
            disabled={!selectedEventId}
            className="gradient-pdv text-white font-bold uppercase"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir/Exportar
          </Button>
        </div>

        <Card className="bg-white border-gray-200 no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
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
          <div id="printable-report" className="bg-white p-8 rounded-lg shadow-sm">
            <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedEvent.name}</h1>
              {selectedEvent.theme && (
                <p className="text-xl text-pdv-green italic">"{selectedEvent.theme}"</p>
              )}
            </div>

            <Tabs value={activeReport} onValueChange={setActiveReport} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6 no-print">
                <TabsTrigger value="detailed" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Detallado
                </TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="projection" className="flex items-center gap-2">
                  <Projector className="w-4 h-4" />
                  Proyección
                </TabsTrigger>
                <TabsTrigger value="sound" className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Sonido
                </TabsTrigger>
                <TabsTrigger value="ushers" className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  Ujieres
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detailed">
                {renderDetailedProgram()}
              </TabsContent>

              <TabsContent value="general">
                {renderGeneralProgram()}
              </TabsContent>

              <TabsContent value="projection">
                {renderProjectionView()}
              </TabsContent>

              <TabsContent value="sound">
                {renderSoundView()}
              </TabsContent>

              <TabsContent value="ushers">
                {renderUshersView()}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!selectedEventId && (
          <Card className="p-12 text-center border-dashed border-2 bg-white border-gray-300">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Selecciona un evento para ver los informes disponibles</p>
          </Card>
        )}
      </div>
    </>
  );
}