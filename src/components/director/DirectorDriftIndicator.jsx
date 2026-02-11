import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Clock, Wallet } from 'lucide-react';

/**
 * DirectorDriftIndicator - Shows cumulative drift and time bank status
 * 
 * Drift = total minutes behind schedule (from overruns)
 * Time Bank = minutes gained from early finishes (can offset drift)
 */
export default function DirectorDriftIndicator({
  cumulativeDrift,
  timeBankMin,
  sessionEndTime,
  language
}) {
  const netDrift = cumulativeDrift - timeBankMin;
  
  // Determine severity
  let driftColor = 'text-green-400';
  let driftBg = 'bg-green-900/30';
  let driftBorder = 'border-green-700';
  
  if (netDrift > 10) {
    driftColor = 'text-red-400';
    driftBg = 'bg-red-900/30';
    driftBorder = 'border-red-700';
  } else if (netDrift > 5) {
    driftColor = 'text-amber-400';
    driftBg = 'bg-amber-900/30';
    driftBorder = 'border-amber-700';
  } else if (netDrift > 0) {
    driftColor = 'text-yellow-400';
    driftBg = 'bg-yellow-900/30';
    driftBorder = 'border-yellow-700';
  }
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Net Drift */}
      <Card className={`${driftBg} border ${driftBorder} p-3`}>
        <div className="flex items-center gap-2 mb-1">
          {netDrift > 0 ? (
            <TrendingUp className={`w-4 h-4 ${driftColor}`} />
          ) : netDrift < 0 ? (
            <TrendingDown className="w-4 h-4 text-green-400" />
          ) : (
            <Clock className="w-4 h-4 text-green-400" />
          )}
          <span className="text-xs text-slate-400 uppercase">
            {language === 'es' ? 'Desviación Neta' : 'Net Drift'}
          </span>
        </div>
        <div className={`text-2xl font-mono font-bold ${driftColor}`}>
          {netDrift > 0 ? '+' : ''}{netDrift} min
        </div>
      </Card>
      
      {/* Cumulative Overrun */}
      <Card className="bg-slate-800/50 border border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400 uppercase">
            {language === 'es' ? 'Acumulado' : 'Overruns'}
          </span>
        </div>
        <div className="text-2xl font-mono font-bold text-slate-300">
          +{cumulativeDrift} min
        </div>
      </Card>
      
      {/* Time Bank */}
      <Card className="bg-slate-800/50 border border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400 uppercase">
            {language === 'es' ? 'Banco de Tiempo' : 'Time Bank'}
          </span>
        </div>
        <div className="text-2xl font-mono font-bold text-slate-300">
          {timeBankMin} min
        </div>
      </Card>
      
      {/* Session End */}
      <Card className="bg-slate-800/50 border border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400 uppercase">
            {language === 'es' ? 'Fin Planificado' : 'Planned End'}
          </span>
        </div>
        <div className="text-2xl font-mono font-bold text-slate-300">
          {sessionEndTime || '—'}
        </div>
      </Card>
    </div>
  );
}