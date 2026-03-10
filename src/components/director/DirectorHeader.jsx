import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Radio, 
  Clock, 
  Lock, 
  Unlock,
  UserCheck,
  Power,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * DirectorHeader - Top bar for Director Console
 * Shows session info, clock, lock status, and control buttons
 */
export default function DirectorHeader({
  session,
  event,
  currentUser,
  currentTime,
  isCurrentDirector,
  isLocked,
  heldSegment,
  onRefetch,
  language,
  backPath
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };
  
  const handleAcquireLock = async () => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: true
      });
      toast.success(language === 'es' ? 'Modo Director activado' : 'Director Mode enabled');
      onRefetch();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        // Someone else is director
        setShowTakeoverDialog(true);
      } else {
        toast.error(language === 'es' ? 'Error al activar' : 'Failed to enable');
      }
    } finally {
      setIsLoading(false);
      setShowEnableDialog(false);
    }
  };
  
  const handleReleaseLock = async () => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'toggle_live_adjustment',
        value: false
      });
      toast.success(language === 'es' ? 'Modo Director desactivado' : 'Director Mode disabled');
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al desactivar' : 'Failed to disable');
    } finally {
      setIsLoading(false);
      setShowDisableDialog(false);
    }
  };
  
  const handleTakeover = async () => {
    setIsLoading(true);
    try {
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        action: 'takeover'
      });
      toast.success(language === 'es' ? 'Control tomado' : 'Control taken over');
      onRefetch();
    } catch (err) {
      console.error(err);
      toast.error(language === 'es' ? 'Error al tomar control' : 'Failed to take over');
    } finally {
      setIsLoading(false);
      setShowTakeoverDialog(false);
    }
  };
  
  const isLiveActive = session?.live_adjustment_enabled;
  
  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          {/* Top row: Back + Title + Clock */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button 
                asChild 
                variant="ghost" 
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Link to={backPath || createPageUrl('PublicProgramView')}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  {language === 'es' ? 'Director Console' : 'Director Console'}
                  {isLiveActive && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 line-clamp-1">
                  {session.name} {event?.name ? `• ${event.name}` : ''}
                </p>
              </div>
            </div>
            
            {/* Clock */}
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-lg sm:text-xl font-bold tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>
          </div>
          
          {/* Bottom row: Status + Controls */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
            {/* Status */}
            <div className="flex items-center gap-2">
              {isLiveActive ? (
                <>
                  <Badge className="bg-red-600 text-white">
                    <Radio className="w-3 h-3 mr-1 animate-pulse" />
                    LIVE
                  </Badge>
                  {isCurrentDirector ? (
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      <UserCheck className="w-3 h-3 mr-1" />
                      {language === 'es' ? 'Tú eres Director' : 'You are Director'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500 text-amber-400">
                      <Lock className="w-3 h-3 mr-1" />
                      {session.live_director_user_name}
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  <Unlock className="w-3 h-3 mr-1" />
                  {language === 'es' ? 'Modo Director Inactivo' : 'Director Mode Inactive'}
                </Badge>
              )}
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* 
               * REMOVED: Chat link button (2026-02-11)
               * 
               * Chat is now integrated via StickyOpsDeck + LiveOperationsChat
               * in DirectorConsole.js, matching the Live View experience.
               * 
               * See Decision: "Shared Live Ops Components Across Views"
               * 
               * DO NOT re-add a separate chat trigger here.
               */}
              
              {/* Lock/Unlock controls */}
              {!isLiveActive && (
                <Button
                  onClick={() => setShowEnableDialog(true)}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  <Power className="w-4 h-4 mr-1" />
                  {language === 'es' ? 'Activar Director' : 'Enable Director'}
                </Button>
              )}
              
              {isLiveActive && isCurrentDirector && (
                <Button
                  onClick={() => setShowDisableDialog(true)}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="border-red-700 text-red-400 hover:bg-red-900/30"
                >
                  <Power className="w-4 h-4 mr-1" />
                  {language === 'es' ? 'Desactivar' : 'Disable'}
                </Button>
              )}
              
              {isLocked && (
                <Button
                  onClick={() => setShowTakeoverDialog(true)}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  {language === 'es' ? 'Tomar Control' : 'Take Over'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Enable Dialog */}
      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-red-500" />
              {language === 'es' ? 'Activar Modo Director' : 'Enable Director Mode'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {language === 'es'
                ? 'Esto te dará control exclusivo sobre los tiempos en vivo. Los cambios serán visibles para todos los usuarios inmediatamente.'
                : 'This will give you exclusive control over live timing. Changes will be visible to all users immediately.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAcquireLock} className="bg-red-600 hover:bg-red-700">
              {language === 'es' ? 'Activar' : 'Enable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Disable Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-amber-500" />
              {language === 'es' ? 'Desactivar Modo Director' : 'Disable Director Mode'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {heldSegment ? (
                <span className="block mb-2 text-amber-400 font-medium">
                  ⚠️ {language === 'es'
                    ? `"${heldSegment.title}" tiene un Hold activo que será abortado. Los segmentos completados se conservarán.`
                    : `"${heldSegment.title}" has an active Hold that will be aborted. Completed segments will be preserved.`}
                </span>
              ) : null}
              {language === 'es'
                ? 'Los segmentos completados conservarán sus tiempos. Liberarás el control para que otro usuario pueda tomar el mando.'
                : 'Completed segments will keep their times. You will release control so another user can take over.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReleaseLock} className="bg-amber-600 hover:bg-amber-700">
              {language === 'es' ? 'Desactivar' : 'Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Takeover Dialog */}
      <AlertDialog open={showTakeoverDialog} onOpenChange={setShowTakeoverDialog}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              {language === 'es' ? 'Tomar Control' : 'Take Over Control'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {language === 'es'
                ? `${session?.live_director_user_name || 'Otro usuario'} es actualmente el Director. Si tomas el control, serán notificados.`
                : `${session?.live_director_user_name || 'Another user'} is currently the Director. If you take over, they will be notified.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-600">
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeover} className="bg-amber-600 hover:bg-amber-700">
              {language === 'es' ? 'Confirmar' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}