import React from "react";
import { formatTimeToEST, formatDateET } from "@/components/utils/timeFormat";

/**
 * StandbyScreen
 * 
 * TV-optimized idle screen displayed when no program is currently active.
 * Intentionally static — no framer-motion, no animated orbs.
 * Layout: clock top-right, brand center, status footer.
 * 
 * Receives currentTime as prop so it ticks from the parent's interval.
 */
export default function StandbyScreen({ currentTime }) {
  const now = currentTime || new Date();
  const timeStr = now.toTimeString().substring(0, 5);
  
  // Format date for display: "Domingo — 02-09-2026"
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayName = dayNames[now.getDay()];
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = formatDateET(`${year}-${month}-${day}`);

  return (
    <div className="w-full h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Gradient Bar */}
      <div className="w-full h-2 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] shrink-0" />

      {/* Clock — Top Right */}
      <div className="w-full flex justify-end px-8 pt-6 shrink-0">
        <div className="text-3xl md:text-4xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-5 py-2 rounded-xl border border-slate-200 shadow-sm">
          {formatTimeToEST(timeStr)}
        </div>
      </div>

      {/* Center Content — Brand */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <h1 className="text-7xl md:text-9xl text-slate-900 tracking-tighter uppercase mb-4 leading-none">
          Palabras de Vida
        </h1>
        
        {/* Gradient Divider */}
        <div className="w-32 h-2 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] rounded-full mb-6" />

        {/* Date */}
        <p className="text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] uppercase tracking-widest font-semibold mb-2">
          {dayName} — {dateStr}
        </p>

        {/* Motto */}
        <h2 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] uppercase tracking-widest">
          ¡Atrévete a Cambiar!
        </h2>
        <p className="text-slate-400 mt-2 text-sm uppercase tracking-[0.3em] font-medium">
          Dare to Change
        </p>
      </div>

      {/* Footer / Status */}
      <div className="w-full text-center pb-8 shrink-0">
        <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Standby Mode • Waiting for Program
        </p>
      </div>
    </div>
  );
}