import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Printer, Filter, Projector, Volume2, Users as UsersIcon, List, Languages, UserCheck, Mic, Utensils, ExternalLink, Share2, Copy, Check, Music, Sliders, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTimeToEST } from "../components/utils/timeFormat";

export default function Reports() {
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeReport, setActiveReport] = useState("detailed");
  const [copySuccess, setCopySuccess] = useState(false);

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



  const { data: allPreSessionDetails = [] } = useQuery({
    queryKey: ['preSessionDetails'],
    queryFn: () => base44.entities.PreSessionDetails.list(),
  });

  const { data: allHospitalityTasks = [] } = useQuery({
    queryKey: ['hospitalityTasks'],
    queryFn: () => base44.entities.HospitalityTask.list(),
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

  const eventColorClasses = {
    green: 'border-t-8 border-pdv-green',
    blue: 'border-t-8 border-blue-500',
    pink: 'border-t-8 border-pink-500',
    orange: 'border-t-8 border-orange-500',
    yellow: 'border-t-8 border-yellow-400',
    purple: 'border-t-8 border-purple-500',
    red: 'border-t-8 border-red-500',
    teal: 'border-t-8 border-teal-600',
    charcoal: 'border-t-8 border-gray-800',
  };

  const handlePrint = () => {
    window.print();
  };

  const getPublicViewUrl = () => {
    const baseUrl = window.location.origin;
    const pagePath = createPageUrl("PublicProgramView");
    return `${baseUrl}${pagePath}?eventId=${selectedEventId}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPublicViewUrl());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenPublicView = () => {
    navigate(createPageUrl("PublicProgramView") + `?eventId=${selectedEventId}`);
  };

  const getSegmentActions = (segment) => {
    return segment?.segment_actions || [];
  };

  const departmentColors = {
    Admin: "bg-orange-50 border-orange-200 text-orange-700",
    MC: "bg-blue-50 border-blue-200 text-blue-700",
    Sound: "bg-red-50 border-red-200 text-red-700",
    Projection: "bg-purple-50 border-purple-200 text-purple-700",
    Hospitality: "bg-pink-50 border-pink-200 text-pink-700",
    Ujieres: "bg-green-50 border-green-200 text-green-700",
    Kids: "bg-yellow-50 border-yellow-200 text-yellow-700",
    Coordinador: "bg-orange-50 border-orange-200 text-orange-700",
    "Stage & Decor": "bg-purple-50 border-purple-200 text-purple-700",
    Other: "bg-gray-50 border-gray-200 text-gray-700"
  };

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "";
  };





  const renderDetailedProgram = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id);
        const hasHospitalityTasks = allHospitalityTasks.some(task => task.session_id === session.id);
        if (segments.length === 0) return null;

        // If event has a print_color, use it for top border. Otherwise fallback to session color (left border) or default
        const borderClass = selectedEvent?.print_color 
          ? `${eventColorClasses[selectedEvent.print_color] || 'border-t-8 border-blue-500'} border-l-2 border-r-2 border-b-2` 
          : `${sessionColorClasses[session.session_color] || ''} border-2`;

        return (
          <div key={session.id} className={`print-session border-gray-200 rounded-lg overflow-hidden ${borderClass}`}>
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-2 border-b border-gray-200">
              <div className="flex justify-between items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-1">
                    <span className="hidden print:inline mr-2 text-gray-500">{selectedEvent.name} —</span>
                    {session.name}
                  </h2>
                  {hasHospitalityTasks && (
                    <Utensils className="w-5 h-5 text-pink-600" title="Tiene instrucciones de hospitalidad" />
                  )}
                </div>
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

              <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 mt-1 text-[10px]">
                {session.presenter && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-blue-700 font-bold">PRES:</span>
                    <span className="text-gray-800 ml-1">{session.presenter}</span>
                  </span>
                )}
                {session.worship_leader && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-green-600 font-bold">ALAB:</span>
                    <span className="text-gray-800 ml-1">{session.worship_leader}</span>
                  </span>
                )}
                {session.coordinators && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-indigo-600 font-bold">COORD:</span>
                    <span className="text-gray-800 ml-1">{session.coordinators}</span>
                  </span>
                )}
                {session.admin_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-orange-600 font-bold">ADMIN:</span>
                    <span className="text-gray-800 ml-1">{session.admin_team}</span>
                  </span>
                )}
                {session.sound_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-red-600 font-bold">SONIDO:</span>
                    <span className="text-gray-800 ml-1">{session.sound_team}</span>
                  </span>
                )}
                {session.tech_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-purple-600 font-bold">TÉC:</span>
                    <span className="text-gray-800 ml-1">{session.tech_team}</span>
                  </span>
                )}
                {session.ushers_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-blue-600 font-bold">UJIER:</span>
                    <span className="text-gray-800 ml-1">{session.ushers_team}</span>
                  </span>
                )}
                {session.translation_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-purple-700 font-bold">TRAD:</span>
                    <span className="text-gray-800 ml-1">{session.translation_team}</span>
                  </span>
                )}
                {session.hospitality_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-pink-600 font-bold">HOSP:</span>
                    <span className="text-gray-800 ml-1">{session.hospitality_team}</span>
                  </span>
                )}
                {session.photography_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200 truncate">
                    <span className="text-teal-600 font-bold">FOTO:</span>
                    <span className="text-gray-800 ml-1">{session.photography_team}</span>
                  </span>
                )}
              </div>

              {allPreSessionDetails.filter(psd => psd.session_id === session.id).map(psd => (
                <div key={psd.id} className="mt-2 bg-blue-50 border border-blue-200 p-2 rounded text-[10px]">
                  <div className="font-bold text-blue-700 uppercase mb-1">Detalles Previos (Segmento 0)</div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                    {psd.music_profile_id && (
                      <div><Music className="inline-block w-3 h-3 mr-1 text-blue-600" /> Música: {psd.music_profile_id}</div>
                    )}
                    {psd.slide_pack_id && (
                      <div><Sliders className="inline-block w-3 h-3 mr-1 text-blue-600" /> Slides: {psd.slide_pack_id}</div>
                    )}
                    {psd.registration_desk_open_time && (
                      <div><span className="font-semibold">Registro:</span> {formatTimeToEST(psd.registration_desk_open_time)}</div>
                    )}
                    {psd.library_open_time && (
                      <div><span className="font-semibold">Librería:</span> {formatTimeToEST(psd.library_open_time)}</div>
                    )}
                    {psd.facility_notes && (
                      <div className="col-span-2"><span className="font-semibold">Instalaciones:</span> {psd.facility_notes}</div>
                    )}
                    {psd.general_notes && (
                      <div className="col-span-2"><span className="font-semibold">General:</span> {psd.general_notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="p-1 text-gray-900 font-bold uppercase w-12 text-center text-xs">Hora</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-3/5">Detalles</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-2/5">Notas por Equipo</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((segment, idx) => {
                    if (segment.segment_type === "Breakout" && segment.breakout_rooms) {
                      return (
                        <React.Fragment key={segment.id}>
                        {/* Prep Actions Row - spans full width above segment */}
                        {getSegmentActions(segment).filter(a => a.is_prep !== false).length > 0 && (
                          <tr className="bg-amber-50 border-t-2 border-amber-300">
                            <td colSpan="3" className="p-2">
                              <div className="flex items-start gap-2">
                                <div className="bg-amber-500 text-white px-2 py-1 rounded font-bold text-[10px] uppercase whitespace-nowrap">
                                  ⚠ PREP
                                </div>
                                <div className="flex-1 flex flex-wrap gap-2">
                                  {getSegmentActions(segment).filter(a => a.is_prep !== false).map((action, actionIdx) => (
                                    <div
                                      key={actionIdx}
                                      className={`text-[10px] px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                    >
                                      <span className="font-bold">[{action.department}]</span> {action.label}
                                      {action.is_required && <span className="ml-1 text-red-600">*</span>}
                                      {action.timing && action.offset_min !== undefined && (
                                        <span className="italic ml-1">
                                          ({action.timing === "before_start" && `${action.offset_min}m antes`}
                                          {action.timing === "before_end" && `${action.offset_min}m antes de fin`}
                                          {action.timing === "absolute" && action.absolute_time})
                                        </span>
                                      )}
                                      {action.notes && <span className="ml-1">— {action.notes}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr key={segment.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${getSegmentActions(segment).filter(a => a.is_prep !== false).length === 0 && idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
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
                            </div>
                          </td>
                          <td className="p-2 border-r border-gray-200" colSpan="2">
                            <div className="bg-amber-50 border border-amber-300 rounded p-2">
                              <div className="text-amber-900 font-bold text-xs uppercase mb-2">
                                {segment.title} - SESIONES PARALELAS
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {segment.breakout_rooms.map((room, roomIdx) => (
                                  <div key={roomIdx} className="bg-white p-2 rounded border border-gray-200">
                                    {room.room_id && (
                                      <Badge variant="outline" className="text-[9px] bg-blue-50 mb-1">
                                        {getRoomName(room.room_id)}
                                      </Badge>
                                    )}
                                    <div className="font-bold text-xs text-gray-900 mb-1">{room.topic || `Sala ${roomIdx + 1}`}</div>
                                    {room.hosts && (
                                      <div className="text-indigo-600 font-semibold text-[10px] mb-0.5">
                                        <span className="font-bold">Anfitrión:</span> {room.hosts}
                                      </div>
                                    )}
                                    {room.speakers && (
                                      <div className="text-blue-600 font-semibold text-[10px] mb-1">
                                        <span className="font-bold">Presentador:</span> {room.speakers}
                                      </div>
                                    )}
                                    {room.requires_translation && (
                                      <div className="flex items-center gap-1 text-[10px] text-purple-700 mb-1">
                                        <Languages className="w-3 h-3" />
                                        {room.translation_mode === "InPerson" && <Mic className="w-3 h-3" />}
                                        {room.translator_name && <span>{room.translator_name}</span>}
                                      </div>
                                    )}
                                    {(room.general_notes || room.other_notes) && (
                                      <div className="mt-1 text-[9px] space-y-0.5">
                                        {room.general_notes && (
                                          <div className="bg-purple-50 px-1 rounded">
                                            <span className="font-bold text-purple-700">PROD:</span>
                                            <span className="ml-1">{room.general_notes}</span>
                                          </div>
                                        )}
                                        {room.other_notes && (
                                          <div className="bg-gray-50 px-1 rounded">
                                            <span className="font-bold text-gray-700">OTRAS:</span>
                                            <span className="ml-1">{room.other_notes}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={segment.id}>
                      {/* Prep Actions Row - spans full width above segment */}
                      {getSegmentActions(segment).filter(a => a.is_prep !== false).length > 0 && (
                        <tr className="bg-amber-50 border-t-2 border-amber-300">
                          <td colSpan="3" className="p-2">
                            <div className="flex items-start gap-2">
                              <div className="bg-amber-500 text-white px-2 py-1 rounded font-bold text-[10px] uppercase whitespace-nowrap">
                                ⚠ PREP
                              </div>
                              <div className="flex-1 flex flex-wrap gap-2">
                                {getSegmentActions(segment).filter(a => a.is_prep !== false).map((action, actionIdx) => (
                                  <div
                                    key={actionIdx}
                                    className={`text-[10px] px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                  >
                                    <span className="font-bold">[{action.department}]</span> {action.label}
                                    {action.is_required && <span className="ml-1 text-red-600">*</span>}
                                    {action.timing && action.offset_min !== undefined && (
                                      <span className="italic ml-1">
                                        ({action.timing === "before_start" && `${action.offset_min}m antes`}
                                        {action.timing === "before_end" && `${action.offset_min}m antes de fin`}
                                        {action.timing === "absolute" && action.absolute_time})
                                      </span>
                                    )}
                                    {action.notes && <span className="ml-1">— {action.notes}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr key={segment.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${getSegmentActions(segment).filter(a => a.is_prep !== false).length === 0 && idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
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
                        <div className={getSegmentActions(segment).filter(a => a.is_prep === false).length > 0 ? "grid grid-cols-2 gap-2" : ""}>
                          <div className={getSegmentActions(segment).filter(a => a.is_prep === false).length > 0 ? "space-y-1" : "grid grid-cols-2 gap-x-4 gap-y-1"}>
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

                            {segment.has_video && (
                              <div className="mt-1 text-[10px] bg-blue-50 p-1 rounded border border-blue-200">
                                <span className="text-blue-700 font-bold">VIDEO:</span>
                                <span className="text-gray-700 ml-1">{segment.video_name}</span>
                                {segment.video_location && <span className="text-gray-600 ml-1">({segment.video_location})</span>}
                                {segment.video_length_sec && <span className="text-gray-600 ml-1">- {Math.floor(segment.video_length_sec / 60)}:{String(segment.video_length_sec % 60).padStart(2, '0')}</span>}
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

                            {segment.segment_type === "Artes" && segment.art_types && segment.art_types.length > 0 && (
                              <div className="mt-1 text-[10px] bg-pink-50 p-1 rounded border border-pink-200">
                                <span className="text-pink-700 font-bold">ARTES:</span>
                                <span className="text-gray-700 ml-1">{segment.art_types.map(t => t === "DANCE" ? "Danza" : t === "DRAMA" ? "Drama" : t === "VIDEO" ? "Video" : "Otro").join(", ")}</span>

                                {segment.art_types.includes("DRAMA") && (
                                  <div className="mt-0.5 pl-2 border-l-2 border-pink-300">
                                    {segment.drama_handheld_mics > 0 && <div>Mics mano: {segment.drama_handheld_mics}</div>}
                                    {segment.drama_headset_mics > 0 && <div>Mics diadema: {segment.drama_headset_mics}</div>}
                                    {segment.drama_start_cue && <div>Inicio: {segment.drama_start_cue}</div>}
                                    {segment.drama_end_cue && <div>Cierre: {segment.drama_end_cue}</div>}
                                    {segment.drama_has_song && segment.drama_song_title && (
                                      <div>Canción: {segment.drama_song_title}</div>
                                    )}
                                  </div>
                                )}

                                {segment.art_types.includes("DANCE") && (
                                  <div className="mt-0.5 pl-2 border-l-2 border-pink-300">
                                    {segment.dance_has_song && segment.dance_song_title && (
                                      <div>Música: {segment.dance_song_title}</div>
                                    )}
                                    {segment.dance_handheld_mics > 0 && <div>Mics mano: {segment.dance_handheld_mics}</div>}
                                    {segment.dance_headset_mics > 0 && <div>Mics diadema: {segment.dance_headset_mics}</div>}
                                  </div>
                                )}

                                {segment.art_types.includes("OTHER") && segment.art_other_description && (
                                  <div className="mt-0.5 text-gray-600">
                                    {segment.art_other_description}
                                  </div>
                                )}
                              </div>
                            )}

                            {segment.description_details && (
                              <div className="text-gray-600 text-[10px] mt-1">
                                {segment.description_details}
                              </div>
                            )}
                          </div>

                          {/* In-segment cues shown in the details column */}
                          {getSegmentActions(segment).filter(a => a.is_prep === false).length > 0 && (
                          <div className="border-l border-gray-200 pl-2">
                              <div className="text-[10px] space-y-0.5">
                                <div className="font-bold uppercase text-blue-700 mb-0.5 flex items-center gap-1">
                                  <span className="bg-blue-100 px-1 rounded">▶ DURANTE</span>
                                </div>
                                {getSegmentActions(segment).filter(a => a.is_prep === false).map((action, actionIdx) => (
                                  <div
                                    key={actionIdx}
                                    className={`p-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                  >
                                    <div className="flex items-start gap-1">
                                      <div className="flex-1">
                                        <div className="font-semibold">
                                          [{action.department}] {action.label}
                                          {action.is_required && <span className="ml-1 text-red-600">*</span>}
                                        </div>
                                        {action.timing && action.offset_min !== undefined && (
                                          <div className="italic">
                                            {action.timing === "before_start" && `${action.offset_min} min antes de iniciar`}
                                            {action.timing === "after_start" && `${action.offset_min} min después de iniciar`}
                                            {action.timing === "before_end" && `${action.offset_min} min antes de terminar`}
                                            {action.timing === "absolute" && action.absolute_time}
                                          </div>
                                        )}
                                        {action.notes && <div>{action.notes}</div>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                          </div>
                          )}
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
                          {segment.stage_decor_notes && (
                            <div className="bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                              <span className="font-bold text-purple-700">STAGE & DECOR:</span>
                              <span className="ml-1">{segment.stage_decor_notes}</span>
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
                          {!segment.projection_notes && !segment.sound_notes && !segment.ushers_notes && !segment.requires_translation && !segment.stage_decor_notes && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                    );
                  })}
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
          <div key={session.id} className="print-session">
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
          <div key={session.id} className="print-session">
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
          <div key={session.id} className="print-session">
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

  const renderHospitalityView = () => (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const hospitalityTasksForSession = allHospitalityTasks.filter(task => task.session_id === session.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        if (hospitalityTasksForSession.length === 0) return null;

        return (
          <div key={session.id} className="print-session">
            <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-lg mb-4 border border-pink-200">
              <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-pink-50 border-b-2 border-pink-200">
                  <th className="p-3 text-left font-bold text-gray-900 w-24">Tiempo</th>
                  <th className="p-3 text-left font-bold text-gray-900">Categoría</th>
                  <th className="p-3 text-left font-bold text-gray-900">Descripción</th>
                  <th className="p-3 text-left font-bold text-gray-900">Ubicación</th>
                  <th className="p-3 text-left font-bold text-gray-900">Notas</th>
                </tr>
              </thead>
              <tbody>
                {hospitalityTasksForSession.map((task, idx) => (
                  <tr key={task.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-mono font-medium text-gray-900">{task.time_hint || "-"}</td>
                    <td className="p-3 text-gray-700">{task.category}</td>
                    <td className="p-3 text-gray-700">{task.description}</td>
                    <td className="p-3 text-gray-700">{task.location_notes || "-"}</td>
                    <td className="p-3 text-gray-700">{task.notes || "-"}</td>
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
          <div key={session.id} className="print-session">
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
            size: letter landscape;
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
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .print-session {
            break-inside: avoid;
            page-break-inside: avoid;
            display: block;
            width: 100%;
            margin-bottom: 0 !important;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
          }

          /* Force new page before every session except the first one */
          .print-session:not(:first-of-type) {
            break-before: page;
            page-break-before: always;
          }
          
          /* Optimization for print density */
          .print-session table {
            width: 100%;
          }
          .print-session th, .print-session td {
            padding: 2px 4px !important;
          }
          .print-session .text-xl {
            font-size: 14px !important;
            line-height: 1.2;
          }
          .print-session .text-lg {
            font-size: 12px !important;
          }
          .print-session .text-xs {
            font-size: 10px !important;
          }
          .print-session .text-\[10px\] {
            font-size: 9px !important;
          }
          
          /* Tighten up spacing */
          .print-session .p-2 {
            padding: 0.25rem !important;
          }
          .print-session .gap-2 {
            gap: 0.25rem !important;
          }
          .print-session .mb-4 {
            margin-bottom: 0.5rem !important;
          }

        }
      `}</style>
      
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 uppercase">Informes de Eventos</h1>
            <p className="text-gray-600 mt-1">Visualiza y exporta reportes de eventos</p>
          </div>
          <div className="flex gap-3">
            {selectedEventId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline"
                    className="font-bold uppercase"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Vista Pública
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenPublicView}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir Vista Pública
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-600" />
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar Enlace
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button 
              onClick={handlePrint}
              disabled={!selectedEventId}
              className="gradient-pdv text-white font-bold uppercase"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir/Exportar
            </Button>
          </div>
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


            {/* Standard header for screen view */}
            <div className="text-center mb-3 border-b border-gray-300 pb-2 print:hidden">
              <h1 className="text-xl font-bold text-gray-900 inline">{selectedEvent.name}</h1>
              {selectedEvent.theme && (
                <p className="text-sm text-pdv-green italic inline ml-2">"{selectedEvent.theme}"</p>
              )}
            </div>

            <Tabs value={activeReport} onValueChange={setActiveReport} className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-6 no-print">
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
                <TabsTrigger value="hospitality" className="flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Hospitalidad
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

              <TabsContent value="hospitality">
                {renderHospitalityView()}
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