import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Radio, Link as LinkIcon, Clock, ChevronDown } from "lucide-react";
import { useClockTick } from "@/components/utils/useClockTick";
import { resolveBlockTime } from "@/components/utils/streamTiming";
import StreamBlockItem from "@/components/session/StreamBlockItem";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function StreamCoordinatorView({ session, segments, currentUser, embedded = false }) {
  const currentTime = useClockTick();
  const scrollRef = useRef(null);
  
  // Fetch StreamBlocks
  const { data: blocks = [] } = useQuery({
    queryKey: ['streamBlocks', session.id],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: session.id }, 'order'),
    enabled: !!session.id,
    refetchInterval: 5000 // Poll for updates
  });

  // Calculate live state for all blocks
  const blocksWithTime = React.useMemo(() => {
    return blocks.map(block => {
      const { startTime, endTime, isOrphaned } = resolveBlockTime(block, segments, session.date);
      
      const isCurrent = startTime && endTime && currentTime >= startTime && currentTime <= endTime;
      const isNext = startTime && currentTime < startTime;
      
      return {
        ...block,
        startTime,
        endTime,
        isOrphaned,
        isCurrent,
        isNext
      };
    });
  }, [blocks, segments, session.date, currentTime]); // Updates every second due to currentTime

  // Find Current and Next
  const currentBlock = blocksWithTime.find(b => b.isCurrent);
  
  // Find next block (first one in future)
  const nextBlock = blocksWithTime
    .filter(b => b.isNext)
    .sort((a, b) => a.startTime - b.startTime)[0];

  // Auto-scroll to current block on change
  useEffect(() => {
    if (currentBlock && scrollRef.current) {
      const el = document.getElementById(`stream-block-${currentBlock.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentBlock?.id]);

  // Countdown logic
  const getCountdown = (targetDate) => {
    if (!targetDate) return "--:--";
    const diff = targetDate - currentTime;
    if (diff < 0) return "00:00";
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const isDiverging = currentBlock && currentBlock.block_type !== 'link';

  return (
    <div className={`flex flex-col ${embedded ? 'h-full border-none rounded-none' : 'h-[calc(100vh-140px)] rounded-xl border border-gray-300'} bg-gray-100 overflow-hidden`}>
      {/* Top Bar - Hidden in embedded mode */}
      {!embedded && (
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              <h2 className="font-bold text-lg tracking-wide uppercase">Livestream Coordinator</h2>
            </div>
            <span className="text-slate-400 text-sm border-l border-slate-700 pl-3">
              {session.name}
            </span>
          </div>
          <div className="font-mono text-xl text-blue-400 font-bold">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 shrink-0 border-b-4 border-slate-900">
        {/* Left: ON AIR */}
        <div className={`p-6 ${isDiverging ? 'bg-red-900' : 'bg-slate-800'} text-white relative overflow-hidden`}>
          <div className="absolute top-4 right-4 opacity-20">
            <Radio className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`${isDiverging ? 'bg-red-600' : 'bg-green-600'} text-white border-none animate-pulse`}>
                ON AIR
              </Badge>
              {isDiverging && (
                <Badge variant="outline" className="text-red-200 border-red-400 font-bold">
                  DIVERGING FROM ROOM
                </Badge>
              )}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black uppercase leading-tight mb-2 line-clamp-2">
              {currentBlock ? currentBlock.title : "WAITING FOR START"}
            </h1>
            
            {currentBlock && (
              <div className="text-slate-300 text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Ends in: <span className="font-mono font-bold text-white">{getCountdown(currentBlock.endTime)}</span></span>
              </div>
            )}

            {/* Current Cues */}
            {currentBlock?.stream_actions?.length > 0 && (
              <div className="mt-4 bg-black/30 p-3 rounded-lg border border-white/10">
                <div className="text-xs text-slate-400 uppercase font-bold mb-2">Active Cues</div>
                <div className="space-y-1">
                  {currentBlock.stream_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-yellow-400 font-bold">▶</span>
                      <span>{action.label}</span>
                      {action.notes && <span className="text-slate-400 text-xs">- {action.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: UP NEXT */}
        <div className="bg-slate-100 p-6 border-l border-slate-300 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Up Next</div>
          
          {nextBlock ? (
            <>
              <h2 className="text-2xl font-bold text-slate-800 mb-1 line-clamp-1">{nextBlock.title}</h2>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="border-slate-400 text-slate-600">
                  {nextBlock.block_type.toUpperCase()}
                </Badge>
                <span className="text-slate-500 text-sm">
                  Starts in <span className="font-mono font-bold text-slate-900">{getCountdown(nextBlock.startTime)}</span>
                </span>
              </div>
              
              {/* Prep Cues for Next */}
              {nextBlock.stream_actions?.filter(a => a.timing === 'before_start').length > 0 && (
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Prep Cues</div>
                  {nextBlock.stream_actions.filter(a => a.timing === 'before_start').map((action, i) => (
                    <div key={i} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="text-blue-500 font-bold">⚠</span>
                      {action.label}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-400 italic">End of stream</div>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-hidden relative bg-gray-50">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-2 max-w-4xl mx-auto">
            {blocksWithTime.map((block, index) => (
              <div id={`stream-block-${block.id}`} key={block.id}>
                <StreamBlockItem 
                  block={block}
                  index={index}
                  total={blocks.length}
                  segments={segments}
                  sessionDate={session.date}
                  readOnly={true}
                  isCurrent={block.isCurrent}
                  compact={embedded}
                />
              </div>
            ))}
            
            {blocks.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No stream blocks configured for this session.
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Scroll hint if needed */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}