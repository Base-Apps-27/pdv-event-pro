import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSegmentData } from "@/components/utils/segmentDataUtils";
import { Badge } from "@/components/ui/badge";
import { Clock, Music, Users, AlertCircle } from "lucide-react";

export default function WeeklyServiceReport({ date }) {
  const { data: serviceData } = useQuery({
    queryKey: ['weeklyService', date],
    queryFn: async () => {
      const services = await base44.entities.Service.filter({ date });
      return services[0] || null;
    },
    enabled: !!date
  });

  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['allAnnouncements'],
    queryFn: () => base44.entities.AnnouncementItem.list('priority'),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  if (!serviceData) {
    return (
      <div className="text-center p-8 text-gray-500">
        No hay datos para este servicio dominical.
      </div>
    );
  }

  const selectedAnnouncements = serviceData.selected_announcements || [];
  
  const announcementsToShow = allAnnouncements
    .filter(a => selectedAnnouncements.includes(a.id))
    .sort((a, b) => (a.priority || 10) - (b.priority || 10));

  const eventsToShow = events
    .filter(e => selectedAnnouncements.includes(e.id))
    .sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0));

  const isCustomService = serviceData.segments && serviceData.segments.length > 0;

  const renderCustomService = () => {
    const segments = serviceData.segments || [];
    // Custom services store teams in { main: "Name" } or just "Name" string
    const getTeam = (field) => {
      const val = serviceData[field];
      if (!val) return "";
      if (typeof val === 'object') return val.main || "";
      return val;
    };

    const coordinators = getTeam('coordinators');
    const ujieres = getTeam('ujieres');
    const sound = getTeam('sound');
    const luces = getTeam('luces');

    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border-l-4 border-pdv-teal shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="text-2xl font-bold uppercase mb-2 text-pdv-teal">{serviceData.name || "Servicio Personalizado"}</h3>
            <Badge variant="outline" className="text-lg px-3 py-1">{serviceData.time || "Hora por definir"}</Badge>
          </div>
          
          {/* Team Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
            {coordinators && (
              <div className="bg-white px-3 py-2 rounded border shadow-sm">
                <span className="font-bold text-indigo-600 block text-xs uppercase tracking-wider">Coordinador</span>
                <span className="font-medium text-gray-800">{coordinators}</span>
              </div>
            )}
            {ujieres && (
              <div className="bg-white px-3 py-2 rounded border shadow-sm">
                <span className="font-bold text-blue-600 block text-xs uppercase tracking-wider">Ujieres</span>
                <span className="font-medium text-gray-800">{ujieres}</span>
              </div>
            )}
            {sound && (
              <div className="bg-white px-3 py-2 rounded border shadow-sm">
                <span className="font-bold text-red-600 block text-xs uppercase tracking-wider">Sonido</span>
                <span className="font-medium text-gray-800">{sound}</span>
              </div>
            )}
            {luces && (
              <div className="bg-white px-3 py-2 rounded border shadow-sm">
                <span className="font-bold text-purple-600 block text-xs uppercase tracking-wider">Luces/Proyección</span>
                <span className="font-medium text-gray-800">{luces}</span>
              </div>
            )}
          </div>
        </div>

        {/* Segments */}
        <div className="space-y-3">
          {segments.map((segment, idx) => {
            const getData = (field) => getSegmentData(segment, field);
            const leader = getData('leader');
            const presenter = getData('presenter');
            const preacher = getData('preacher');
            const translator = getData('translator');
            const songs = getData('songs');
            const messageTitle = getData('messageTitle');
            const verse = getData('verse');
            const description = getData('description');
            const description_details = getData('description_details');
            const coordinator_notes = getData('coordinator_notes');
            const projection_notes = getData('projection_notes');
            const sound_notes = getData('sound_notes');
            const ushers_notes = getData('ushers_notes');
            const translation_notes = getData('translation_notes');
            const stage_decor_notes = getData('stage_decor_notes');
            const actions = getData('actions');
            
            // Normalize segment type
            const segmentType = segment.type || segment.data?.type || 'Especial';

            return (
            <Card key={idx} className={`border-l-4 ${segmentType === 'Especial' ? 'border-l-orange-500' : 'border-l-pdv-teal'}`}>
              <CardHeader className="pb-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-sm w-6">{idx + 1}.</span>
                    {segment.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{segmentType}</Badge>
                    <Badge variant="outline">{segment.duration} min</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 text-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Content & People */}
                  <div className="space-y-2">
                    {/* Primary Roles */}
                    {(leader || presenter || preacher) && (
                      <div className="flex items-center gap-2 text-base">
                        <span className="font-semibold text-pdv-teal">
                          {leader ? "Dirige:" : preacher ? "Predica:" : "Presenta:"}
                        </span>
                        <span className="font-medium">{leader || preacher || presenter}</span>
                      </div>
                    )}
                    
                    {translator && (
                      <div className="text-sm bg-blue-50 p-1.5 rounded border border-blue-100 inline-block">
                        <span className="font-semibold text-blue-700">🌐 Traductor:</span> {translator}
                      </div>
                    )}

                    {/* Songs */}
                    {songs && songs.length > 0 && songs.some(s => s.title) && (
                      <div className="bg-green-50 p-3 rounded border border-green-200 mt-2">
                        <div className="font-semibold text-green-800 mb-1 text-xs uppercase tracking-wide">Repertorio</div>
                        <ul className="space-y-1">
                          {songs.filter(s => s.title).map((song, sIdx) => (
                            <li key={sIdx} className="text-sm text-gray-800 flex justify-between">
                              <span>• {song.title}</span>
                              {song.lead && <span className="text-gray-500 text-xs italic">{song.lead}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Message Details */}
                    {(messageTitle || verse) && (
                      <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-2">
                        {messageTitle && (
                          <div className="mb-1"><span className="font-semibold text-blue-800">Título:</span> {messageTitle}</div>
                        )}
                        {verse && (
                          <div className="text-blue-900 italic">📖 {verse}</div>
                        )}
                      </div>
                    )}

                    {/* General Description */}
                    {(description || description_details) && (
                      <div className="text-gray-700 mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                        {description && <div className="mb-1">{description}</div>}
                        {description_details && <div className="text-xs text-gray-500">{description_details}</div>}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Technical & Operational Notes */}
                  <div className="space-y-2 text-xs border-l pl-4 md:border-gray-200">
                    <div className="font-semibold text-gray-400 uppercase tracking-widest mb-1">Notas Técnicas</div>
                    
                    {coordinator_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-indigo-600">COORD:</span>
                        <span>{coordinator_notes}</span>
                      </div>
                    )}
                    {projection_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-purple-600">PROYECCIÓN:</span>
                        <span>{projection_notes}</span>
                      </div>
                    )}
                    {sound_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-red-600">SONIDO:</span>
                        <span>{sound_notes}</span>
                      </div>
                    )}
                    {ushers_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-green-600">UJIERES:</span>
                        <span>{ushers_notes}</span>
                      </div>
                    )}
                    {translation_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-blue-600">TRADUCCIÓN:</span>
                        <span>{translation_notes}</span>
                      </div>
                    )}
                    {stage_decor_notes && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="font-bold text-pink-600">STAGE:</span>
                        <span>{stage_decor_notes}</span>
                      </div>
                    )}

                    {/* Actions */}
                    {actions && actions.length > 0 && (
                      <div className="mt-3 bg-amber-50 p-2 rounded border border-amber-200">
                        <div className="font-semibold text-amber-900 mb-1">Cues / Acciones:</div>
                        {actions.map((action, aIdx) => (
                          <div key={aIdx} className="text-amber-800 mb-0.5">
                            • {action.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    );
  };

  const renderService = (timeSlot, color) => {
    const segments = serviceData[timeSlot] || [];
    const coordinators = serviceData.coordinators?.[timeSlot] || "";
    const ujieres = serviceData.ujieres?.[timeSlot] || "";
    const sound = serviceData.sound?.[timeSlot] || "";
    const luces = serviceData.luces?.[timeSlot] || "";

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-gray-50 to-white p-3 rounded-lg border-l-4" style={{ borderLeftColor: color }}>
          <h3 className="text-2xl font-bold uppercase mb-2" style={{ color }}>{timeSlot}</h3>
          
          {/* Team Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {coordinators && (
              <div className="bg-white px-2 py-1 rounded border">
                <span className="font-bold text-indigo-600">COORD:</span>
                <span className="ml-1">{coordinators}</span>
              </div>
            )}
            {ujieres && (
              <div className="bg-white px-2 py-1 rounded border">
                <span className="font-bold text-blue-600">UJIER:</span>
                <span className="ml-1">{ujieres}</span>
              </div>
            )}
            {sound && (
              <div className="bg-white px-2 py-1 rounded border">
                <span className="font-bold text-red-600">SONIDO:</span>
                <span className="ml-1">{sound}</span>
              </div>
            )}
            {luces && (
              <div className="bg-white px-2 py-1 rounded border">
                <span className="font-bold text-purple-600">LUCES:</span>
                <span className="ml-1">{luces}</span>
              </div>
            )}
          </div>
        </div>

        {/* Segments */}
        <div className="space-y-2">
          {segments.map((segment, idx) => {
            const getData = (field) => getSegmentData(segment, field);
            // Note: Standard service segments usually have data structure already, but we use safe accessor just in case
            
            // Standard segments often have 'type' at root
            const segmentType = segment.type || segment.data?.type || 'Especial';
            
            return (
            <Card key={idx} className="border-l-4" style={{ borderLeftColor: color }}>
              <CardHeader className="pb-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color }} />
                    {segment.title}
                  </CardTitle>
                  <Badge variant="outline">{segment.duration} min</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-3 text-sm space-y-2">
                {/* Worship Details */}
                {segmentType === 'worship' && (
                  <>
                    {getData('leader') && (
                      <div className="flex items-start gap-2">
                        <Music className="w-4 h-4 text-pdv-green mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-pdv-green">Líder:</span>
                          <span className="ml-2">{getData('leader')}</span>
                        </div>
                      </div>
                    )}
                    {getData('translator') && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700">🌐 Traductor(a):</span>
                        <span className="ml-1">{getData('translator')}</span>
                      </div>
                    )}
                    {segment.songs && segment.songs.length > 0 && (
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <div className="font-semibold text-green-700 mb-1 text-xs">Canciones:</div>
                        {segment.songs.map((song, sIdx) => (
                          song.title && (
                            <div key={sIdx} className="text-xs text-gray-700">
                              {sIdx + 1}. {song.title} {song.lead && <span className="text-gray-500">({song.lead})</span>}
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    {getData('ministry_leader') && (
                      <div className="bg-purple-50 p-2 rounded border border-purple-200">
                        <span className="font-semibold text-purple-700 text-xs">Ministración (5 min):</span>
                        <span className="ml-1 text-xs">{getData('ministry_leader')}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Welcome/Offering Details */}
                {(segmentType === 'welcome' || segmentType === 'offering') && (
                  <>
                    {getData('presenter') && (
                      <div>
                        <span className="font-semibold text-blue-600">Presentador:</span>
                        <span className="ml-2">{getData('presenter')}</span>
                      </div>
                    )}
                    {getData('translator') && (
                      <div className="text-xs text-blue-600">
                        🌐 Traductor(a): {getData('translator')}
                      </div>
                    )}
                    {getData('verse') && (
                      <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-semibold text-amber-700">Verso:</span>
                        <span className="ml-1">{getData('verse')}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Message Details */}
                {segmentType === 'message' && (
                  <>
                    {getData('preacher') && (
                      <div>
                        <span className="font-semibold text-blue-600">Predicador:</span>
                        <span className="ml-2">{getData('preacher')}</span>
                      </div>
                    )}
                    {getData('translator') && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700">🌐 Traductor(a):</span>
                        <span className="ml-1">{getData('translator')}</span>
                      </div>
                    )}
                    {getData('title') && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700 text-xs">Título:</span>
                        <span className="ml-1 text-xs">{getData('title')}</span>
                      </div>
                    )}
                    {getData('verse') && (
                      <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-semibold text-amber-700">Verso:</span>
                        <span className="ml-1">{getData('verse')}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Special Segment Details */}
                {segmentType === 'special' && (
                  <>
                    {getData('presenter') && (
                      <div>
                        <span className="font-semibold text-orange-600">Presentador:</span>
                        <span className="ml-2">{getData('presenter')}</span>
                      </div>
                    )}
                    {getData('translator') && (
                      <div className="text-xs text-blue-600">
                        🌐 Traductor(a): {getData('translator')}
                      </div>
                    )}
                    {getData('description') && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {getData('description')}
                      </div>
                    )}
                  </>
                )}

                {/* Coordinator Actions */}
                {segment.actions && segment.actions.length > 0 && (
                  <div className="bg-amber-50 p-2 rounded border border-amber-200">
                    <div className="font-semibold text-amber-900 text-xs mb-1">⏰ Acciones:</div>
                    {segment.actions.map((action, aIdx) => (
                      <div key={aIdx} className="text-xs text-amber-800">
                        • {action.label}
                        {action.timing === "before_end" && ` (${action.offset_min} min antes de terminar)`}
                        {action.timing === "after_start" && action.offset_min > 0 && ` (${action.offset_min} min después de iniciar)`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Additional Notes */}
                {getData('description_details') && (
                  <div className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                    <span className="font-semibold text-gray-700">Notas:</span>
                    <span className="ml-1">{getData('description_details')}</span>
                  </div>
                )}
                {getData('projection_notes') && (
                  <div className="text-xs bg-purple-50 p-2 rounded border border-purple-200">
                    <span className="font-semibold text-purple-700">Proyección:</span>
                    <span className="ml-1">{getData('projection_notes')}</span>
                  </div>
                )}
                {getData('sound_notes') && (
                  <div className="text-xs bg-red-50 p-2 rounded border border-red-200">
                    <span className="font-semibold text-red-700">Sonido:</span>
                    <span className="ml-1">{getData('sound_notes')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <div className="w-20 h-1 mx-auto mb-4 bg-gradient-to-r from-pdv-teal via-pdv-green to-pdv-yellow" />
        <h1 className="text-3xl font-bold uppercase mb-1">Orden de Servicio</h1>
        <p className="text-xl text-blue-600">{serviceData.day_of_week || 'Domingo'} {date}</p>
      </div>

      {/* Services Grid — dynamic slot discovery */}
      {isCustomService ? (
        renderCustomService()
      ) : (
        (() => {
          const REPORT_COLORS = ['#DC2626', '#2563EB', '#9333EA', '#D97706', '#16A34A'];
          const slotKeys = Object.keys(serviceData)
            .filter(k => /^\d+:\d+[ap]m$/i.test(k) && Array.isArray(serviceData[k]))
            .sort((a, b) => {
              const pa = a.match(/^(\d+):(\d+)(am|pm)$/i);
              const pb = b.match(/^(\d+):(\d+)(am|pm)$/i);
              if (!pa || !pb) return 0;
              let ha = parseInt(pa[1]); if (pa[3].toLowerCase() === 'pm' && ha < 12) ha += 12;
              let hb = parseInt(pb[1]); if (pb[3].toLowerCase() === 'pm' && hb < 12) hb += 12;
              return (ha * 60 + parseInt(pa[2])) - (hb * 60 + parseInt(pb[2]));
            });
          return (
            <div className={`grid md:grid-cols-${Math.min(slotKeys.length, 3)} gap-8`}>
              {slotKeys.map((slot, idx) => renderService(slot, REPORT_COLORS[idx % REPORT_COLORS.length]))}
            </div>
          );
        })()
      )}

      {/* Receso Blocks — between each consecutive slot pair */}
      {(() => {
        const reportSlotKeys = Object.keys(serviceData)
          .filter(k => /^\d+:\d+[ap]m$/i.test(k) && Array.isArray(serviceData[k]))
          .sort((a, b) => {
            const pa = a.match(/^(\d+):(\d+)(am|pm)$/i);
            const pb = b.match(/^(\d+):(\d+)(am|pm)$/i);
            if (!pa || !pb) return 0;
            let ha = parseInt(pa[1]); if (pa[3].toLowerCase() === 'pm' && ha < 12) ha += 12;
            let hb = parseInt(pb[1]); if (pb[3].toLowerCase() === 'pm' && hb < 12) hb += 12;
            return (ha * 60 + parseInt(pa[2])) - (hb * 60 + parseInt(pb[2]));
          });
        return reportSlotKeys.slice(0, -1).map((slotKey, idx) => {
          const recesoNote = serviceData.receso_notes?.[slotKey];
          if (!recesoNote) return null;
          return (
            <Card key={`receso-${slotKey}`} className="bg-gray-100 border-gray-300">
              <CardHeader>
                <CardTitle className="text-lg text-gray-600">
                  RECESO{reportSlotKeys.length > 2 ? ` (${slotKey} → ${reportSlotKeys[idx + 1]})` : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                {recesoNote}
              </CardContent>
            </Card>
          );
        });
      })()}

      {/* Announcements Section */}
      {(announcementsToShow.length > 0 || eventsToShow.length > 0) && (
        <div className="print-break-before-page">
          <h2 className="text-2xl font-bold uppercase mb-4 border-b-2 pb-2">Anuncios</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {announcementsToShow.map(ann => (
              <Card key={ann.id} className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{ann.title}</CardTitle>
                    {ann.has_video && (
                      <Badge className="bg-purple-100 text-purple-800">📹</Badge>
                    )}
                  </div>
                  {ann.date_of_occurrence && (
                    <p className="text-xs font-semibold text-blue-600 mt-1">
                      📅 {ann.date_of_occurrence}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="whitespace-pre-wrap">{ann.content}</p>
                  {ann.instructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="text-xs text-amber-900 font-semibold mb-1">Instrucciones:</p>
                      <p className="text-xs text-amber-800 whitespace-pre-wrap">{ann.instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {eventsToShow.map(event => (
              <Card key={event.id} className="border-2 bg-blue-50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{event.name}</CardTitle>
                    <Badge className="bg-purple-200 text-purple-800">Evento</Badge>
                    {event.announcement_has_video && (
                      <Badge className="bg-purple-100 text-purple-800">📹</Badge>
                    )}
                  </div>
                  {(event.start_date || event.end_date) && (
                    <p className="text-xs font-semibold text-blue-600 mt-1">
                      📅 {event.start_date} {event.end_date && `- ${event.end_date}`}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="whitespace-pre-wrap">{event.announcement_blurb || event.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}