import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { formatTimeToEST } from "@/components/utils/timeFormat";

export default function LiveAdminControls({ session, currentSegment, nextSegment, refetchData }) {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  if (!session) return null;

  const handleToggle = async (checked) => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: checked
      });
      toast.success(checked ? t('live.enabled') : t('live.disabled'));
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkEnded = async () => {
    if (!currentSegment) return;
    setIsLoading(true);
    try {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: currentSegment.id,
        action: 'mark_ended',
        value: currentHHMM
      });
      toast.success(t('live.segment_ended'));
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelay = async (minutes) => {
    // If current segment exists, delay it (extend it)
    // If not (between segments?), delay next segment start
    const targetSegment = currentSegment || nextSegment;
    if (!targetSegment) return;

    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: targetSegment.id,
        action: 'adjust_start', // This effectively delays everything from this point
        value: minutes
      });
      toast.success(t('live.time_adjusted', { minutes }));
      refetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900 text-white border-none shadow-xl mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="live-mode" 
                checked={session.live_adjustment_enabled || false}
                onCheckedChange={handleToggle}
                disabled={isLoading}
                className="data-[state=checked]:bg-red-600"
              />
              <Label htmlFor="live-mode" className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                {t('live.admin_mode')} 
                {session.live_adjustment_enabled && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </Label>
            </div>
          </div>

          {session.live_adjustment_enabled && (
            <div className="flex flex-wrap items-center gap-2">
              {currentSegment && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleMarkEnded}
                  disabled={isLoading}
                  className="font-bold"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  {t('live.mark_ended')}
                </Button>
              )}
              
              <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
                <span className="text-xs px-2 text-slate-400 font-bold uppercase">{t('live.delay')}:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelay(1)}
                  disabled={isLoading}
                  className="h-7 px-2 text-white hover:bg-slate-700"
                >
                  +1m
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelay(5)}
                  disabled={isLoading}
                  className="h-7 px-2 text-white hover:bg-slate-700"
                >
                  +5m
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelay(10)}
                  disabled={isLoading}
                  className="h-7 px-2 text-white hover:bg-slate-700"
                >
                  +10m
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {session.live_adjustment_enabled && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>{t('live.active_warning')}</span>
            </div>
            {currentSegment && (
              <span>
                {t('live.current')}: <span className="text-white font-bold">{currentSegment.title}</span> 
                {currentSegment.actual_end_time && ` (Ends: ${formatTimeToEST(currentSegment.actual_end_time)})`}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}