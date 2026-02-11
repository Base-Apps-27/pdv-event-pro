/**
 * Hospitality Report View — Hospitality tasks table per session
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-3d)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 */
import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import PreSessionDetailsBlock from "./PreSessionDetailsBlock";

export default function HospitalityReportView({ eventSessions, allHospitalityTasks, allPreSessionDetails }) {
  return (
    <div className="space-y-6">
      {eventSessions.map((session) => {
        const hospitalityTasksForSession = allHospitalityTasks.filter(task => task.session_id === session.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        if (hospitalityTasksForSession.length === 0) return null;

        return (
          <div key={session.id} className="print-session">
            <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-lg mb-4 border border-pink-200">
              <h3 className="text-xl text-gray-900">{session.name}</h3>
              <p className="text-gray-700">{session.date} • {session.planned_start_time ? formatTimeToEST(session.planned_start_time) : "Por definir"}</p>
            </div>

            <PreSessionDetailsBlock sessionId={session.id} allPreSessionDetails={allPreSessionDetails} />

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
}