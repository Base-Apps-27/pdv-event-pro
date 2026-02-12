import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Radio, 
  X, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  Clock
} from 'lucide-react';
import { formatTimestampToEST } from '@/components/utils/timeFormat';
import { motion, AnimatePresence } from 'framer-motion';
import { safeGetJSON, safeSetJSON } from '@/components/utils/safeLocalStorage';

/**
 * DirectorPingFeed - Shows incoming @Director pings in the Director Console
 * 
 * Displays a compact alert bar when there are unacknowledged director pings.
 * Expands to show full list. Auto-refreshes via subscription.
 * 
 * Phase 5: Chat Enhancements
 */
export default function DirectorPingFeed({ 
  eventId, 
  currentUser, 
  language 
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => {
    // Load acknowledged IDs from localStorage (Phase 5: safe wrapper)
    return safeGetJSON(`director_ping_ack:${eventId}`, []);
  });

  // Fetch director pings for this event
  const { data: allPings = [] } = useQuery({
    queryKey: ['directorPings', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      // Fetch recent director pings (last 24 hours would be ideal, but filter by event)
      const messages = await base44.entities.LiveOperationsMessage.filter({
        context_type: 'event',
        context_id: eventId,
        is_director_ping: true,
        is_archived: false
      }, '-created_date');
      return messages.slice(0, 20); // Limit to 20 most recent
    },
    enabled: !!eventId,
    refetchInterval: 10000, // Fallback poll every 10s
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!eventId) return;
    
    const unsubscribe = base44.entities.LiveOperationsMessage.subscribe((event) => {
      if (event.data?.context_type === 'event' && 
          event.data?.context_id === eventId && 
          event.data?.is_director_ping) {
        queryClient.invalidateQueries(['directorPings', eventId]);
      }
    });

    return unsubscribe;
  }, [eventId, queryClient]);

  // Filter out acknowledged pings
  const unacknowledgedPings = allPings.filter(p => !acknowledgedIds.includes(p.id));
  const hasUnacknowledged = unacknowledgedPings.length > 0;

  // Persist acknowledged IDs
  const acknowledgePing = (pingId) => {
    const newAcked = [...acknowledgedIds, pingId];
    setAcknowledgedIds(newAcked);
    safeSetJSON(`director_ping_ack:${eventId}`, newAcked);
  };

  const acknowledgeAll = () => {
    const newAcked = [...acknowledgedIds, ...unacknowledgedPings.map(p => p.id)];
    setAcknowledgedIds(newAcked);
    safeSetJSON(`director_ping_ack:${eventId}`, newAcked);
    setIsExpanded(false);
  };

  // Don't render if no pings
  if (allPings.length === 0) return null;

  const formatTime = (dateStr) => {
    const timestamp = formatTimestampToEST(dateStr);
    return timestamp ? timestamp.split(' ').slice(0, 2).join(' ') : '';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border-b border-slate-800"
      >
        {/* Compact alert bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full px-4 sm:px-6 py-2 flex items-center justify-between gap-3 transition-colors ${
            hasUnacknowledged 
              ? 'bg-red-900/30 hover:bg-red-900/50 border-b border-red-800' 
              : 'hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${hasUnacknowledged ? 'text-red-400' : 'text-slate-500'}`}>
              <Radio className={`w-4 h-4 ${hasUnacknowledged ? 'animate-pulse' : ''}`} />
              <span className="font-semibold text-sm">
                @Director
              </span>
            </div>
            
            {hasUnacknowledged ? (
              <Badge className="bg-red-600 text-white text-xs">
                {unacknowledgedPings.length} {language === 'es' ? 'nuevo' : 'new'}{unacknowledgedPings.length > 1 ? 's' : ''}
              </Badge>
            ) : (
              <span className="text-xs text-slate-500">
                {allPings.length} {language === 'es' ? 'total' : 'total'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasUnacknowledged && (
              <Badge 
                variant="outline" 
                className="border-red-600 text-red-400 text-xs hidden sm:flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                {unacknowledgedPings[0]?.created_by_name || 'Team'}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>
        
        {/* Expanded list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 sm:px-6 py-3 space-y-2 max-h-64 overflow-y-auto bg-slate-900/50">
                {/* Acknowledge all button */}
                {hasUnacknowledged && (
                  <div className="flex justify-end pb-2 border-b border-slate-800">
                    <Button
                      onClick={acknowledgeAll}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      {language === 'es' ? 'Marcar todo como visto' : 'Mark all as read'}
                    </Button>
                  </div>
                )}
                
                {/* Ping list - show unacknowledged first, then acknowledged */}
                {[...unacknowledgedPings, ...allPings.filter(p => acknowledgedIds.includes(p.id))].map((ping) => {
                  const isUnacked = !acknowledgedIds.includes(ping.id);
                  return (
                    <div
                      key={ping.id}
                      className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                        isUnacked 
                          ? 'bg-red-900/20 border border-red-800/50' 
                          : 'bg-slate-800/30 opacity-60'
                      }`}
                    >
                      <Radio className={`w-4 h-4 mt-0.5 shrink-0 ${isUnacked ? 'text-red-500 animate-pulse' : 'text-slate-600'}`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className={`font-semibold ${isUnacked ? 'text-red-400' : 'text-slate-500'}`}>
                            {ping.created_by_name || ping.created_by?.split('@')[0] || 'Team'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(ping.created_date)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${isUnacked ? 'text-white' : 'text-slate-400'}`}>
                          {ping.message || '[Image]'}
                        </p>
                      </div>
                      
                      {isUnacked && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            acknowledgePing(ping.id);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-500 hover:text-white shrink-0"
                          title={language === 'es' ? 'Marcar como visto' : 'Mark as read'}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                
                {allPings.length === 0 && (
                  <p className="text-center text-slate-500 py-4 text-sm">
                    {language === 'es' ? 'No hay pings de director' : 'No director pings'}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}