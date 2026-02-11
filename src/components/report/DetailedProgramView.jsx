/**
 * Detailed Program View — Full 3-column table with time/details/notes
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-2)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 * 
 * This is the largest view (~385 lines). Extract as-is — do NOT further decompose in Phase 3.
 */
import React from "react";
import { Languages, Mic, Utensils, Music, Sliders } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { useLanguage } from "@/components/utils/i18n";
import SegmentReportRow from "@/components/report/SegmentReportRow";
import PreSessionDetailsBlock from "./PreSessionDetailsBlock";
import {
  sessionColorClasses,
  eventColorClasses,
  departmentColors,
  getSegmentActions,
  isPrepAction,
  calculateActionTime,
} from "./reportHelpers";

export default function DetailedProgramView({
  eventSessions,
  getSessionSegments,
  selectedEvent,
  allPreSessionDetails,
  allHospitalityTasks,
  rooms,
}) {
  const { t } = useLanguage();

  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "";
  };

  return (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const segments = getSessionSegments(session.id);
        const hasHospitalityTasks = allHospitalityTasks.some(task => task.session_id === session.id);
        if (segments.length === 0) return null;

        // Session border logic:
        // - Left border: ALWAYS uses session.session_color for visual distinction between sessions
        // - Top border: Uses event.print_color if set (for event-level branding)
        // - Other borders: thin gray
        const sessionLeftBorderClass = sessionColorClasses[session.session_color] || 'border-l-8 border-l-gray-300';
        const eventTopBorderClass = selectedEvent?.print_color 
          ? (eventColorClasses[selectedEvent.print_color] || 'border-t-4 border-t-blue-500')
          : '';
        const borderClass = `${sessionLeftBorderClass} ${eventTopBorderClass} border-r-2 border-b-2 border-t-2 border-r-gray-200 border-b-gray-200`;
        // Inline styles for custom brand green (not available in Tailwind)
        const leftBorderStyle = session.session_color === 'green' ? { borderLeftColor: '#8DC63F', borderLeftWidth: '8px' } : {};
        const topBorderStyle = selectedEvent?.print_color === 'green' ? { borderTopColor: '#8DC63F', borderTopWidth: '8px' } : {};

        return (
          <div key={session.id} className={`print-session border-gray-200 rounded-lg overflow-hidden ${borderClass}`} style={{ ...leftBorderStyle, ...topBorderStyle }}>
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-2 border-b border-gray-200">
              <div className="flex justify-between items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl uppercase tracking-tight mb-1" style={{ color: '#1F8A70' }}>
                    <span className="hidden print:inline mr-2">{selectedEvent.name} —</span>
                    {session.name}
                  </h2>
                  {hasHospitalityTasks && (
                    <Utensils className="w-5 h-5 text-pink-600" title="Tiene instrucciones de hospitalidad" />
                  )}
                  {session.is_translated_session && (
                    <Languages className="w-5 h-5 text-purple-600" title="Sesión traducida" />
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
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-blue-700 font-bold">PRES:</span>
                    <span className="text-gray-800 ml-1">{session.presenter}</span>
                  </span>
                )}
                {session.worship_leader && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-green-600 font-bold">ALAB:</span>
                    <span className="text-gray-800 ml-1">{session.worship_leader}</span>
                  </span>
                )}
                {session.coordinators && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-indigo-600 font-bold">COORD:</span>
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
                    <span className="text-purple-600 font-bold">TÉC:</span>
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
                    <span className="text-purple-700 font-bold">TRAD:</span>
                    <span className="text-gray-800 ml-1">{session.translation_team}</span>
                  </span>
                )}
                {session.hospitality_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-pink-600 font-bold">HOSP:</span>
                    <span className="text-gray-800 ml-1">{session.hospitality_team}</span>
                  </span>
                )}
                {session.photography_team && (
                  <span className="bg-white bg-opacity-50 px-1 py-0.5 rounded border border-gray-200">
                    <span className="text-teal-600 font-bold">FOTO:</span>
                    <span className="text-gray-800 ml-1">{session.photography_team}</span>
                  </span>
                )}
              </div>

              <PreSessionDetailsBlock sessionId={session.id} allPreSessionDetails={allPreSessionDetails} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="p-1 text-gray-900 font-bold uppercase w-12 text-center text-xs">{t('reports.headers.time')}</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-3/5">{t('reports.headers.details')}</th>
                    <th className="p-1 text-gray-900 font-bold uppercase text-xs w-2/5">{t('reports.headers.teamNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((segment, idx) => {
                    if (segment.segment_type === "Breakout" && segment.breakout_rooms) {
                      return (
                        <React.Fragment key={segment.id}>
                        {/* Prep Actions Row - spans full width above segment */}
                        {getSegmentActions(segment).filter(a => isPrepAction(a)).length > 0 && (
                          <tr className="bg-amber-50 border-t-2 border-amber-300">
                            <td colSpan="3" className="p-2">
                              <div className="flex items-start gap-2">
                                <div className="bg-amber-500 text-white px-2 py-1 rounded font-bold text-[10px] uppercase whitespace-nowrap">
                                  ⚠ PREP
                                </div>
                                <div className="flex-1 flex flex-wrap gap-2">
                                  {getSegmentActions(segment).filter(a => isPrepAction(a)).map((action, actionIdx) => {
                                    const actionTime = calculateActionTime(segment, action);
                                    return (
                                      <div
                                        key={actionIdx}
                                        className={`text-[10px] px-2 py-1 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                      >
                                        <span className="font-bold">[{action.department}]</span> {action.label}
                                        {action.is_required && <span className="ml-1 text-red-600">*</span>}
                                        {actionTime && (
                                          <span className="ml-1 font-mono font-semibold text-amber-700 bg-amber-100 px-1 rounded">@ {actionTime}</span>
                                        )}
                                        {action.notes && <span className="ml-1">— {action.notes}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${getSegmentActions(segment).filter(a => isPrepAction(a)).length === 0 && idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
                        {/* Time cell for Breakout - filled with session color */}
                        <td 
                          className="p-1 font-bold text-center border-r border-gray-200 text-[10px] align-top w-12" 
                          style={{ 
                            verticalAlign: 'top',
                            backgroundColor: session.session_color === 'green' ? '#dcfce7' :
                                            session.session_color === 'blue' ? '#dbeafe' :
                                            session.session_color === 'pink' ? '#fce7f3' :
                                            session.session_color === 'orange' ? '#ffedd5' :
                                            session.session_color === 'yellow' ? '#fef9c3' :
                                            session.session_color === 'purple' ? '#f3e8ff' :
                                            session.session_color === 'red' ? '#fee2e2' : '#f3f4f6'
                          }}
                        >
                            <div className="flex flex-col items-center leading-tight">
                              <div className="whitespace-nowrap text-black font-bold">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
                              {segment.end_time && (
                                <>
                                  <div className="text-gray-600 text-[8px]">↓</div>
                                  <div className="whitespace-nowrap text-black">{formatTimeToEST(segment.end_time)}</div>
                                </>
                              )}
                              {segment.duration_min && (
                                <div className="text-[9px] text-gray-700 mt-0.5">({segment.duration_min}m)</div>
                              )}
                            </div>
                          </td>
                          <td className="p-1 border-r border-gray-200 align-top" colSpan="2" style={{ verticalAlign: 'top' }}>
                            <div className="bg-amber-50 border border-amber-300 rounded p-1">
                              <div className="text-amber-900 font-bold text-xs uppercase mb-2">
                                {segment.title} - SESIONES PARALELAS
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {segment.breakout_rooms.map((room, roomIdx) => (
                                  <div key={roomIdx} className="bg-white p-2 rounded border border-gray-200 text-[10px]">
                                    {room.room_id && (
                                      <Badge variant="outline" className="text-[9px] bg-blue-50 mb-1">
                                        {getRoomName(room.room_id)}
                                      </Badge>
                                    )}
                                    <div className="font-bold text-xs text-gray-900 mb-0.5">{room.topic || `Sala ${roomIdx + 1}`}</div>
                                    {room.hosts && (
                                      <div className="text-indigo-600 font-semibold text-[10px] mb-0.5">
                                        <span className="font-bold">Anfitrión:</span> {room.hosts}
                                      </div>
                                    )}
                                    {room.speakers && (
                                      <div className="text-blue-600 font-semibold text-[10px] mb-0.5">
                                        <span className="font-bold">Presentador:</span> {room.speakers}
                                      </div>
                                    )}
                                    {room.requires_translation && (
                                      <div className="flex items-center gap-1 text-[10px] text-purple-700 mb-0.5">
                                        <Languages className="w-3 h-3" />
                                        {room.translation_mode === "InPerson" && <Mic className="w-3 h-3" />}
                                        {room.translator_name && <span>{room.translator_name}</span>}
                                      </div>
                                    )}
                                    {(room.general_notes || room.other_notes) && (
                                      <div className="mt-0.5 text-[9px] space-y-0.5">
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
                      {getSegmentActions(segment).filter(a => isPrepAction(a)).length > 0 && (
                        <tr className="bg-amber-50 border-t-2 border-amber-300">
                          <td colSpan="3" className="p-1">
                            <div className="flex items-start gap-2">
                              <div className="bg-amber-500 text-white px-2 py-0.5 rounded font-bold text-[9px] uppercase whitespace-nowrap">
                                ⚠ PREP
                              </div>
                              <div className="flex-1 flex flex-wrap gap-1">
                                {getSegmentActions(segment).filter(a => isPrepAction(a)).map((action, actionIdx) => {
                                  const actionTime = calculateActionTime(segment, action);
                                  return (
                                    <div
                                      key={actionIdx}
                                      className={`text-[9px] px-1 py-0.5 rounded border ${departmentColors[action.department] || departmentColors.Other}`}
                                    >
                                      <span className="font-bold">[{action.department}]</span> {action.label}
                                      {action.is_required && <span className="ml-1 text-red-600">*</span>}
                                      {actionTime && (
                                        <span className="ml-1 font-mono font-semibold text-amber-700 bg-amber-100 px-1 rounded">@ {actionTime}</span>
                                      )}
                                      {action.notes && <span className="ml-1">— {action.notes}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${getSegmentActions(segment).filter(a => isPrepAction(a)).length === 0 && idx > 0 ? 'border-t-2 border-gray-400' : ''}`}>
                      {/* Time cell - filled with session color for visibility, black text for contrast */}
                      <td 
                        className="p-1 font-bold text-center border-r border-gray-200 text-[10px] align-top w-12" 
                        style={{ 
                          verticalAlign: 'top',
                          backgroundColor: session.session_color === 'green' ? '#dcfce7' :
                                          session.session_color === 'blue' ? '#dbeafe' :
                                          session.session_color === 'pink' ? '#fce7f3' :
                                          session.session_color === 'orange' ? '#ffedd5' :
                                          session.session_color === 'yellow' ? '#fef9c3' :
                                          session.session_color === 'purple' ? '#f3e8ff' :
                                          session.session_color === 'red' ? '#fee2e2' : '#f3f4f6'
                        }}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <div className="whitespace-nowrap text-black font-bold">{segment.start_time ? formatTimeToEST(segment.start_time) : "-"}</div>
                          {segment.end_time && (
                            <>
                              <div className="text-gray-600 text-[8px]">↓</div>
                              <div className="whitespace-nowrap text-black">{formatTimeToEST(segment.end_time)}</div>
                            </>
                          )}
                          {segment.duration_min && (
                            <div className="text-[9px] text-gray-700 mt-0.5">({segment.duration_min}m)</div>
                          )}
                          <div className="flex gap-0.5 mt-1">
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
                      <td className="p-1 border-r border-gray-200 align-top" style={{ verticalAlign: 'top' }}>
                        <SegmentReportRow
                          segment={segment}
                          idx={idx}
                          getSegmentActions={getSegmentActions}
                          isPrepAction={isPrepAction}
                          getRoomName={getRoomName}
                          departmentColors={departmentColors}
                          t={t}
                          isTableMode={true}
                        />
                      </td>
                      <td className="p-1 text-gray-600 text-[10px] align-top" style={{ verticalAlign: 'top' }}>
                        <SegmentReportRow
                          segment={segment}
                          idx={idx}
                          getSegmentActions={getSegmentActions}
                          isPrepAction={isPrepAction}
                          getRoomName={getRoomName}
                          departmentColors={departmentColors}
                          t={t}
                          isTableMode={true}
                          showOnlyTeamNotes={true}
                        />
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
}