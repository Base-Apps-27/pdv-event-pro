import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer, Filter, Projector, Volume2, Users as UsersIcon, List, Languages, UserCheck, Mic, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatTimeToEST } from "../components/utils/timeFormat";

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
          <div key={session.id} className={`print-session border-2 border-gray-200 rounded-lg overflow-hidden ${sessionColorClasses[session.session_color] || ''}`}>
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-2 border-b border-gray-200">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-1">
                    {session.name}
                  </h2>
                  <div className="text-sm text-gray-700">
                    {session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}
                    {session.location && ` • ${session.location}`}
                    {session.default_stage_call_offset_min && (
                      <span className="ml-2 text-blue-600 font-semibold">
                        • Llegada: {session.default_stage_call_offset_min} min antes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                {session.presenter && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-blue-700 font-bold">PRESENTADOR:</span>
                    <span className="text-gray-800 ml-1">{session.presenter}</span>
                  </span>
                )}
                {session.worship_leader && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-green-600 font-bold">ALABANZA:</span>
                    <span className="text-gray-800 ml-1">{session.worship_leader}</span>
                  </span>
                )}
                {session.coordinators && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-indigo-600 font-bold">COORDINADORES:</span>
                    <span className="text-gray-800 ml-1">{session.coordinators}</span>
                  </span>
                )}
                {session.admin_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-orange-600 font-bold">ADMIN:</span>
                    <span className="text-gray-800 ml-1">{session.admin_team}</span>
                  </span>
                )}
                {session.sound_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-red-600 font-bold">SONIDO:</span>
                    <span className="text-gray-800 ml-1">{session.sound_team}</span>
                  </span>
                )}
                {session.tech_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-purple-600 font-bold">TÉCNICO:</span>
                    <span className="text-gray-800 ml-1">{session.tech_team}</span>
                  </span>
                )}
                {session.ushers_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-blue-600 font-bold">UJIER:</span>
                    <span className="text-gray-800 ml-1">{session.ushers_team}</span>
                  </span>
                )}
                {session.translation_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-purple-700 font-bold">TRADUCCIÓN:</span>
                    <span className="text-gray-800 ml-1">{session.translation_team}</span>
                  </span>
                )}
                {session.hospitality_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-pink-600 font-bold">HOSPITALIDAD:</span>
                    <span className="text-gray-800 ml-1">{session.hospitality_team}</span>
                  </span>
                )}
                {session.photography_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-teal-600 font-bold">FOTOGRAFÍA:</span>
                    <span className="text-gray-800 ml-1">{session.photography_team}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="p-1 text-gray-900 font-bold uppercase w-12 text-center text-xs">Tiempo</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-3/5">Detalles</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-2/5">Notas de Equipos</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((segment, idx) => (
                    <tr key={segment.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
                      <td className="p-2 text-pdv-green font-bold text-center border-r border-gray-200 text-[10px] align-top">
                        <div className="flex flex-col items-center leading-tight">
                          <div className="whitespace-nowrap">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
                          {segment.end_time && (
                            <>
                              <div className="text-gray-400 text-[8px]">↓</div>
                              <div className="whitespace-nowrap">{formatTimeToEST(segment.end_time)}</div>
                            </>
                          )}
                          {segment.duration_min && (
                            <div className="text-[9px] text-gray-600 mt-0.5">({segment.duration_min}m)</div>
                          )}
                          <div className="flex gap-1 mt-2">
                            {segment.requires_translation && segment.translation_mode === "InPerson" && (
                              <>
                                <Languages className="w-3 h-3 text-purple-600" title="Traducción en Persona" />
                                <Mic className="w-3 h-3 text-purple-600" title="En Persona" />
                              </>
                            )}
                            {segment.requires_translation && segment.translation_mode === "RemoteBooth" && (
                              <Languages className="w-3 h-3 text-purple-600" title="Traducción Remota" />
                            )}
                            {segment.major_break && (
                              <Utensils className="w-3 h-3 text-orange-600" title="Receso Mayor" />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="text-gray-900 font-bold text-xs uppercase">
                              {segment.title}
                            </div>
                            
                            {segment.segment_type && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {segment.segment_type}
                              </Badge>
                            )}

                            {segment.presenter && (
                              <div className="text-blue-600 font-semibold text-xs">
                                {segment.presenter}
                              </div>
                            )}

                            {segment.segment_type === "Alabanza" && segment.number_of_songs > 0 && (
                              <div className="mt-1 text-[10px] bg-green-50 p-1 rounded border border-green-200">
                                <span className="text-green-700 font-bold">CANCIONES:</span>
                                <div className="mt-0.5">
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
                              <div className="mt-1 text-[10px] bg-blue-50 p-1 rounded border border-blue-200">
                                <span className="text-blue-700 font-bold">MENSAJE:</span>
                                <span className="text-gray-700 ml-1">{segment.message_title}</span>
                              </div>
                            )}

                            {segment.segment_type === "Plenaria" && segment.scripture_references && (
                              <div className="mt-1 text-[10px] bg-amber-50 p-1 rounded border border-amber-200">
                                <span className="text-amber-700 font-bold">ESCRITURAS:</span>
                                <span className="text-gray-700 ml-1">{segment.scripture_references}</span>
                              </div>
                            )}

                            {segment.description_details && (
                              <div className="text-gray-600 text-[10px] mt-1">
                                {segment.description_details}
                              </div>
                            )}
                          </div>

                          <div className="border-l border-gray-200 pl-2">
                            {getSegmentActions(segment.id).length > 0 ? (
                              <div className="text-[10px] space-y-0.5">
                                <div className="font-bold uppercase text-gray-900 mb-1">ACCIONES:</div>
                                {getSegmentActions(segment.id).map((action, actionIdx) => (
                                  <div
                                    key={action.id}
                                    className={`p-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                  >
                                    <div className="flex items-start gap-1">
                                      <span className="font-bold">{actionIdx + 1}.</span>
                                      <div className="flex-1">
                                        <div className="font-semibold">
                                          [{action.department}] {action.label}
                                        </div>
                                        {action.time_hint && (
                                          <div className="italic">
                                            {action.time_hint}
                                          </div>
                                        )}
                                        {action.details && (
                                          <div>
                                            {action.details}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-gray-600 text-[10px] align-top">
                        <div className="space-y-1">
                          {segment.projection_notes && (
                            <div className="bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                              <span className="font-bold text-purple-700">PROYECCIÓN:</span>
                              <span className="ml-1">{segment.projection_notes}</span>
                            </div>
                          )}
                          {segment.sound_notes && (
                            <div className="bg-red-50 px-1 py-0.5 rounded border border-red-200">
                              <span className="font-bold text-red-700">SONIDO:</span>
                              <span className="ml-1">{segment.sound_notes}</span>
                            </div>
                          )}
                          {segment.ushers_notes && (
                            <div className="bg-green-50 px-1 py-0.5 rounded border border-green-200">
                              <span className="font-bold text-green-700">UJIERES:</span>
                              <span className="ml-1">{segment.ushers_notes}</span>
                            </div>
                          )}
                          {segment.requires_translation && (
                            <div className="bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                              <span className="font-bold text-blue-700">TRADUCCIÓN:</span>
                              {segment.translator_name && (
                                <span className="ml-1">{segment.translator_name}</span>
                              )}
                              {segment.translation_mode === "RemoteBooth" && (
                                <span className="ml-1 italic">(Remoto)</span>
                              )}
                              {segment.translation_notes && (
                                <span className="ml-1">- {segment.translation_notes}</span>
                              )}
                            </div>
                          )}
                          {!segment.projection_notes && !segment.sound_notes && !segment.ushers_notes && !segment.requires_translation && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
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
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
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
          @page {
            size: landscape;
            margin: 0.5cm;
          }
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
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-session {
            page-break-after: always;
            page-break-inside: avoid;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .print-session:last-child {
            page-break-after: auto;
          }
          .print-session table {
            font-size: 0.65rem;
            width: 100%;
          }
          .print-session td, .print-session th {
            padding: 0.15rem !important;
            line-height: 1.2;
          }
          .print-session .overflow-x-auto {
            overflow: visible !important;
          }
        }
      `}
      
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
          <div id="printable-report" className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-center mb-3 border-b border-gray-300 pb-2">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedEvent.name}</h1>
              {selectedEvent.theme && (
                <p className="text-sm text-pdv-green italic">"{selectedEvent.theme}"</p>
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