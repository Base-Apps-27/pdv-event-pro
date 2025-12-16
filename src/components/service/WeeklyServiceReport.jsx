import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          {segments.map((segment, idx) => (
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
                {segment.type === 'worship' && (
                  <>
                    {segment.data?.leader && (
                      <div className="flex items-start gap-2">
                        <Music className="w-4 h-4 text-pdv-green mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-pdv-green">Líder:</span>
                          <span className="ml-2">{segment.data.leader}</span>
                        </div>
                      </div>
                    )}
                    {segment.data?.translator && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700">🌐 Traductor(a):</span>
                        <span className="ml-1">{segment.data.translator}</span>
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
                    {segment.data?.ministry_leader && (
                      <div className="bg-purple-50 p-2 rounded border border-purple-200">
                        <span className="font-semibold text-purple-700 text-xs">Ministración (5 min):</span>
                        <span className="ml-1 text-xs">{segment.data.ministry_leader}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Welcome/Offering Details */}
                {(segment.type === 'welcome' || segment.type === 'offering') && (
                  <>
                    {segment.data?.presenter && (
                      <div>
                        <span className="font-semibold text-blue-600">Presentador:</span>
                        <span className="ml-2">{segment.data.presenter}</span>
                      </div>
                    )}
                    {segment.data?.translator && (
                      <div className="text-xs text-blue-600">
                        🌐 Traductor(a): {segment.data.translator}
                      </div>
                    )}
                    {segment.data?.verse && (
                      <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-semibold text-amber-700">Verso:</span>
                        <span className="ml-1">{segment.data.verse}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Message Details */}
                {segment.type === 'message' && (
                  <>
                    {segment.data?.preacher && (
                      <div>
                        <span className="font-semibold text-blue-600">Predicador:</span>
                        <span className="ml-2">{segment.data.preacher}</span>
                      </div>
                    )}
                    {segment.data?.translator && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700">🌐 Traductor(a):</span>
                        <span className="ml-1">{segment.data.translator}</span>
                      </div>
                    )}
                    {segment.data?.title && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200">
                        <span className="font-semibold text-blue-700 text-xs">Título:</span>
                        <span className="ml-1 text-xs">{segment.data.title}</span>
                      </div>
                    )}
                    {segment.data?.verse && (
                      <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-semibold text-amber-700">Verso:</span>
                        <span className="ml-1">{segment.data.verse}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Special Segment Details */}
                {segment.type === 'special' && (
                  <>
                    {segment.data?.presenter && (
                      <div>
                        <span className="font-semibold text-orange-600">Presentador:</span>
                        <span className="ml-2">{segment.data.presenter}</span>
                      </div>
                    )}
                    {segment.data?.translator && (
                      <div className="text-xs text-blue-600">
                        🌐 Traductor(a): {segment.data.translator}
                      </div>
                    )}
                    {segment.data?.description && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {segment.data.description}
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
                {segment.data?.description_details && (
                  <div className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                    <span className="font-semibold text-gray-700">Notas:</span>
                    <span className="ml-1">{segment.data.description_details}</span>
                  </div>
                )}
                {segment.data?.projection_notes && (
                  <div className="text-xs bg-purple-50 p-2 rounded border border-purple-200">
                    <span className="font-semibold text-purple-700">Proyección:</span>
                    <span className="ml-1">{segment.data.projection_notes}</span>
                  </div>
                )}
                {segment.data?.sound_notes && (
                  <div className="text-xs bg-red-50 p-2 rounded border border-red-200">
                    <span className="font-semibold text-red-700">Sonido:</span>
                    <span className="ml-1">{segment.data.sound_notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
        <p className="text-xl text-blue-600">Domingo {date}</p>
      </div>

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {renderService("9:30am", "#DC2626")}
        {renderService("11:30am", "#2563EB")}
      </div>

      {/* Receso Block */}
      {serviceData.receso_notes?.["9:30am"] && (
        <Card className="bg-gray-100 border-gray-300">
          <CardHeader>
            <CardTitle className="text-lg text-gray-600">RECESO (30 min)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            {serviceData.receso_notes["9:30am"]}
          </CardContent>
        </Card>
      )}

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