import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function EventCalendar({ eventId, sessions, allSessions, segments }) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // month, week, day

  const sessionColorClasses = {
    green: '',
    blue: 'bg-blue-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-400',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  // Get calendar days for current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get week days for week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get sessions for a specific date (all events)
  const getSessionsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allSessions.filter(s => s.date === dateStr).sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Get segments for a session
  const getSegmentsForSession = (sessionId) => {
    return segments
      .filter(seg => seg.session_id === sessionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Navigate to session
  const goToSession = (sessionId) => {
    navigate(createPageUrl("SessionDetail") + `?sessionId=${sessionId}`);
  };

  // Check if session belongs to current event
  const isCurrentEventSession = (session) => {
    return session.event_id === eventId;
  };

  // Month view
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-1">
      {/* Day headers */}
      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
        <div key={day} className="p-2 text-center font-bold text-sm text-gray-700 bg-gray-100 rounded">
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {calendarDays.map((day, index) => {
        const daySessions = getSessionsForDate(day);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={index}
            className={`min-h-24 p-2 border rounded-lg ${
              isCurrentMonth ? 'bg-white' : 'bg-gray-50'
            }`}
            style={isToday ? { boxShadow: '0 0 0 2px #8DC63F' } : {}}
          >
            <div className={`text-sm font-semibold mb-1 ${
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
            }`}
            style={isToday ? { color: '#8DC63F' } : {}}>
              {format(day, 'd')}
            </div>

            <div className="space-y-1">
              {daySessions.map((session) => {
                const isCurrentEvent = isCurrentEventSession(session);
                return (
                  <button
                    key={session.id}
                    onClick={() => goToSession(session.id)}
                    className={`w-full text-left px-1 py-0.5 rounded text-xs truncate hover:opacity-80 transition-opacity ${
                      isCurrentEvent 
                        ? `text-white ${sessionColorClasses[session.session_color] || 'bg-blue-500'}`
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    style={isCurrentEvent && session.session_color === 'green' ? { backgroundColor: '#8DC63F' } : {}}
                    title={session.name}
                  >
                    {session.planned_start_time && formatTimeToEST(session.planned_start_time)} {session.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Week view
  const renderWeekView = () => (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const daySessions = getSessionsForDate(day);
        const isToday = isSameDay(day, new Date());

        return (
          <div key={day.toISOString()} className="border rounded-lg overflow-hidden" style={isToday ? { boxShadow: '0 0 0 2px #8DC63F' } : {}}>
            <div className={`p-2 text-center font-bold text-sm ${
              isToday ? 'text-white' : 'bg-gray-100 text-gray-700'
            }`}
            style={isToday ? { backgroundColor: '#8DC63F' } : {}}>
              <div>{format(day, 'EEE', { locale: es })}</div>
              <div className="text-lg">{format(day, 'd')}</div>
            </div>

            <div className="p-2 space-y-2 bg-white min-h-[400px]">
              {daySessions.map((session) => {
                const sessionSegments = getSegmentsForSession(session.id);
                const isCurrentEvent = isCurrentEventSession(session);
                return (
                  <Card
                    key={session.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                      isCurrentEvent
                        ? sessionColorClasses[session.session_color] || 'border-blue-500'
                        : 'border-gray-300'
                    }`}
                    onClick={() => goToSession(session.id)}
                  >
                    <CardContent className="p-3">
                      <div className="font-semibold text-sm mb-1">{session.name}</div>
                      {session.planned_start_time && (
                        <div className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeToEST(session.planned_start_time)}
                        </div>
                      )}
                      {session.location && (
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {session.location}
                        </div>
                      )}
                      {sessionSegments.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {sessionSegments.length} segmentos
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Day view with timeline
  const renderDayView = () => {
    const daySessions = getSessionsForDate(currentDate);
    const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6);

    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-xl font-bold text-gray-900">
            {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </h3>
        </div>

        {daySessions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay sesiones programadas para este día
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="relative">
                {/* Time labels */}
                <div className="absolute left-0 top-0 w-20 bg-gray-50 border-r">
                  {timeSlots.map((hour) => (
                    <div key={hour} className="h-16 border-b text-xs text-gray-600 p-2 text-right">
                      {hour}:00
                    </div>
                  ))}
                </div>

                {/* Sessions grid */}
                <div className="ml-20 grid gap-2 p-2" style={{ gridTemplateColumns: `repeat(${daySessions.length}, 1fr)` }}>
                  {daySessions.map((session) => {
                    const sessionSegments = getSegmentsForSession(session.id);
                    const isCurrentEvent = isCurrentEventSession(session);
                    
                    return (
                      <div key={session.id} className="relative">
                        {/* Session header */}
                        <div className={`sticky top-0 z-10 p-3 mb-2 rounded-lg shadow ${
                          isCurrentEvent
                            ? `text-white ${sessionColorClasses[session.session_color] || 'bg-blue-500'}`
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          <div className="font-bold text-sm">{session.name}</div>
                          {session.location && (
                            <div className="text-xs opacity-90">{session.location}</div>
                          )}
                        </div>

                        {/* Segments timeline */}
                        <div className="relative" style={{ height: `${timeSlots.length * 64}px` }}>
                          {sessionSegments.map((segment) => {
                            if (!segment.start_time || !segment.end_time) return null;

                            const [startHour, startMin] = segment.start_time.split(':').map(Number);
                            const [endHour, endMin] = segment.end_time.split(':').map(Number);

                            const startMinutes = (startHour - 6) * 60 + startMin;
                            const endMinutes = (endHour - 6) * 60 + endMin;
                            const top = (startMinutes / 60) * 64;
                            const height = ((endMinutes - startMinutes) / 60) * 64;

                            if (startHour < 6 || startHour >= 23) return null;

                            return (
                              <div
                                key={segment.id}
                                className={`absolute left-0 right-0 rounded shadow-sm p-2 overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                                 isCurrentEvent
                                   ? 'bg-white border-l-4'
                                   : 'bg-gray-100 border-l-4 border-gray-400'
                                }`}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  minHeight: '40px',
                                  ...(isCurrentEvent ? { borderLeftColor: '#1F8A70' } : {})
                                }}
                                onClick={() => goToSession(session.id)}
                              >
                                <div className="text-xs font-semibold text-gray-900 truncate">
                                  {segment.title}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {formatTimeToEST(segment.start_time)} - {formatTimeToEST(segment.end_time)}
                                </div>
                                {segment.presenter && (
                                  <div className="text-xs text-gray-500 truncate mt-0.5">
                                    {segment.presenter}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Hour lines */}
                          {timeSlots.map((hour, idx) => (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 border-t border-gray-200"
                              style={{ top: `${idx * 64}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View mode selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded">
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("month")}
            style={viewMode === "month" ? { backgroundColor: '#8DC63F', color: '#ffffff' } : {}}
          >
            Mes
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("week")}
            style={viewMode === "week" ? { backgroundColor: '#8DC63F', color: '#ffffff' } : {}}
          >
            Semana
          </Button>
          <Button
            variant={viewMode === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("day")}
            style={viewMode === "day" ? { backgroundColor: '#8DC63F', color: '#ffffff' } : {}}
          >
            Día
          </Button>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
              else if (viewMode === "week") setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
              else setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>

          <div className="text-sm font-bold text-gray-900 min-w-[180px] text-center">
            {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: es })}
            {viewMode === "week" && `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`}
            {viewMode === "day" && format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
              else if (viewMode === "week") setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
              else setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "month" && renderMonthView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "day" && renderDayView()}
    </div>
  );
}