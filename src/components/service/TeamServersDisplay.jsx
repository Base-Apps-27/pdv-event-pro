import React from "react";
import { Users } from "lucide-react";

/**
 * TeamServersDisplay
 * 
 * TV-optimized team roster display.
 * Shows coordinators, sound, projection, etc. for the active session.
 * Matches the team header format from PDF program reports.
 */
export default function TeamServersDisplay({ session }) {
  if (!session) return null;

  const teams = [
    { label: "Coordinador", value: session.coordinators },
    { label: "Ujieres", value: session.ushers_team },
    { label: "Sonido", value: session.sound_team },
    { label: "Proyección", value: session.tech_team },
    { label: "Fotografía", value: session.photography_team },
    { label: "Traducción", value: session.translation_team },
  ].filter(t => t.value); // Only show teams that have assignments

  if (teams.length === 0) return null;

  return (
    <div className="w-full bg-white/80 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm">
      {/* Header */}
      <div className="bg-slate-100/80 px-2 py-1 border-b border-slate-200">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <Users className="w-3 h-3" />
          Servidores
        </div>
      </div>

      {/* Team Grid */}
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {teams.map((team, idx) => (
          <div key={idx} className="bg-slate-50/80 rounded px-1.5 py-1 border border-slate-200">
            <div className="text-[7px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">
              {team.label}
            </div>
            <div className="text-[9px] text-slate-900 leading-tight font-medium">
              {team.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}