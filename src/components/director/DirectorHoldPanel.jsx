import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Hand, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  SkipForward,
  ArrowRight,
  Loader2,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getSegmentFlexibility, isRigidSegment } from '@/components/utils/segmentFlexibility';

/**
 * DirectorHoldPanel - Shown when a segment is held
 * Allows director to:
 * 1. Finalize the held segment with actual end time
 * 2. Reconcile phantom segments (skip/shift/keep)
 * 3. Review AI cascade proposals
 * 4. Apply selected cascade option
 */
export default function DirectorHoldPanel({
  heldSegment,
  sortedSegments,
  session,
  currentTime,
  currentUser,
  isCurrentDirector,
  onRefetch,
  language
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [actualEndTime, setActualEndTime] = useState('');
  const [step, setStep] = useState('finalize'); // 'finalize' | 'reconcile' | 'cascade'
  const [reconciledSegments, setReconciledSegments] = useState([]);
  const [cascadeOptions, setCascadeOptions] = useState([]);
  const [selectedCascade, setSelectedCascade] = useState(null);
  const [loadingCascade, setLoadingCascade] = useState(false);
  
  const getNowHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  
  // Find phantom segments (segments whose planned time has passed but weren't started)
  const phantomSegments = useMemo(() => {
    if (!actualEndTime) return [];
    
    const endMinutes = parseTimeToMinutes(actualEndTime);
    if (endMinutes === null) return [];
    
    const heldIndex = sortedSegments.findIndex(s => s.id === heldSegment.id);
    const phantoms = [];
    
    for (let i = heldIndex + 1; i < sortedSegments.length; i++) {
      const seg = sortedSegments[i];
      const startMinutes = parseTimeToMinutes(seg.start_time);
      
      // If segment's planned start is before the held segment's actual end, it's a phantom
      if (startMinutes !== null && startMinutes < endMinutes && !seg.actual_start_time) {
        phantoms.push(seg);
      } else {
        break; // No more phantoms
      }
    }
    
    return phantoms;
  }, [actualEndTime, heldSegment, sortedSegments]);
  
  // Remaining segments after phantoms (for cascade)
  const remainingSegments = useMemo(() => {
    if (!actualEndTime) return [];
    
    const heldIndex = sortedSegments.findIndex(s => s.id === heldSegment.id);
    const phantomIds = new Set(phantomSegments.map(p => p.id));
    
    return sortedSegments.slice(heldIndex + 1).filter(s => !phantomIds.has(s.id) && !s.actual_end_time);
  }, [actualEndTime, heldSegment, sortedSegments, phantomSegments]);
  
  const handleFinalizeHold = async () => {
    if (!actualEndTime.match(/^\d{2}:\d{2}$/)) {
      toast.error('HH:MM format required');
      return;
    }
    
    // If there are phantom segments, go to reconcile step
    if (phantomSegments.length > 0) {
      // Initialize reconciled segments with default dispositions
      const defaults = phantomSegments.map(seg => {
        const flex = getSegmentFlexibility(seg.segment_type);
        return {
          id: seg.id,
          title: seg.title,
          segment_type: seg.segment_type,
          disposition: flex.skipDefault, // 'skip' or 'shift'
          flex_score: flex.score
        };
      });
      setReconciledSegments(defaults);
      setStep('reconcile');
    } else {
      // No phantoms, go directly to cascade
      await fetchCascadeOptions();
    }
  };
  
  const handleReconcileComplete = async () => {
    await fetchCascadeOptions();
  };
  
  const fetchCascadeOptions = async () => {
    setLoadingCascade(true);
    setStep('cascade');
    
    try {
      const response = await base44.functions.invoke('generateCascadeProposal', {
        session_id: session.id,
        finalized_segment_id: heldSegment.id,
        actual_end_time: actualEndTime,
        remaining_segments: remainingSegments.map(s => ({
          id: s.id,
          title: s.title,
          segment_type: s.segment_type,
          planned_start_time: s.start_time,
          planned_end_time: s.end_time,
          duration_min: s.duration_min,
          live_status: s.live_status
        })),
        session_planned_end_time: session.planned_end_time,
        next_major_break_end_time: null, // TODO: Calculate from session data
        cumulative_drift_min: calculateDrift(),
        time_bank_min: 0, // TODO: Track time bank
        reconciled_segments: reconciledSegments
      });
      
      if (response.data?.options) {
        setCascadeOptions(response.data.options);
        if (response.data.options.length > 0) {
          setSelectedCascade(0); // Select first option by default
        }
      }
    } catch (err) {
      console.error('Failed to generate cascade options:', err);
      toast.error(language === 'es' ? 'Error al generar opciones' : 'Failed to generate options');
      
      // Provide fallback "shift all" option
      setCascadeOptions([{
        label: 'Shift All (Fallback)',
        label_es: 'Desplazar Todo (Respaldo)',
        description: 'Simply shift all remaining segments by the overrun amount',
        description_es: 'Simplemente desplazar todos los segmentos restantes por el tiempo de exceso',
        segments: remainingSegments.map((s, i) => {
          const overrun = calculateDrift();
          return {
            id: s.id,
            new_start_time: addMinutes(s.start_time, overrun),
            new_end_time: addMinutes(s.end_time, overrun),
            new_duration_min: s.duration_min,
            delta_min: 0
          };
        }),
        projected_session_end: addMinutes(session.planned_end_time, calculateDrift()),
        exceeds_hard_limit: false,
        recovery_min: 0
      }]);
      setSelectedCascade(0);
    } finally {
      setLoadingCascade(false);
    }
  };
  
  const calculateDrift = () => {
    const plannedEnd = parseTimeToMinutes(heldSegment.end_time);
    const actualEnd = parseTimeToMinutes(actualEndTime);
    if (plannedEnd === null || actualEnd === null) return 0;
    return actualEnd - plannedEnd;
  };
  
  const handleApplyCascade = async () => {
    if (selectedCascade === null || !cascadeOptions[selectedCascade]) return;
    
    setIsLoading(true);
    try {
      const option = cascadeOptions[selectedCascade];
      
      // Apply the cascade
      await base44.functions.invoke('updateLiveSegmentTiming', {
        sessionId: session.id,
        segmentId: heldSegment.id,
        action: 'finalize_hold',
        actual_end_time: actualEndTime,
        reconciled_segments: reconciledSegments,
        cascade_option: {
          label: option.label,
          segments: option.segments
        }
      });
      
      toast.success(language === 'es' ? 'Cascade aplicado' : 'Cascade applied');
      onRefetch();
    } catch (err) {
      console.error('Failed to apply cascade:', err);
      toast.error(language === 'es' ? 'Error al aplicar' : 'Failed to apply');
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateReconciled = (segmentId, disposition) => {
    setReconciledSegments(prev => 
      prev.map(s => s.id === segmentId ? { ...s, disposition } : s)
    );
  };
  
  return (
    <Card className="bg-slate-900 border-teal-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Hand className="w-5 h-5 text-teal-400" />
          {language === 'es' ? 'Hold Activo' : 'Active Hold'}
          <Badge className="bg-teal-600 hover:bg-teal-700 ml-2">{heldSegment.title}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Finalize */}
        {step === 'finalize' && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              {language === 'es' 
                ? 'El segmento está en hold. Ingresa la hora de finalización real para continuar.'
                : 'Segment is on hold. Enter the actual end time to continue.'}
            </p>
            
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-48">
                <Label className="text-slate-400 text-xs">
                  {language === 'es' ? 'Hora de Fin Real' : 'Actual End Time'}
                </Label>
                <Input
                  value={actualEndTime}
                  onChange={(e) => setActualEndTime(e.target.value)}
                  placeholder="HH:MM"
                  className="bg-slate-950 border-teal-700/50 text-white font-mono focus:border-teal-500"
                />
              </div>
              <Button
                onClick={() => setActualEndTime(getNowHHMM())}
                variant="outline"
                className="border-teal-700/50 text-teal-400 hover:bg-teal-950 hover:text-teal-300"
              >
                <Clock className="w-4 h-4 mr-1" />
                {language === 'es' ? 'Ahora' : 'Now'}
              </Button>
              <Button
                onClick={handleFinalizeHold}
                disabled={!actualEndTime || isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {language === 'es' ? 'Continuar' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            {/* Preview of phantoms */}
            {actualEndTime && phantomSegments.length > 0 && (
              <div className="mt-4 p-3 bg-amber-900/30 rounded-lg border border-amber-700">
                <div className="flex items-center gap-2 text-amber-300 text-sm mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  {language === 'es' 
                    ? `${phantomSegments.length} segmento(s) afectados por el overrun`
                    : `${phantomSegments.length} segment(s) affected by overrun`}
                </div>
                <div className="space-y-1">
                  {phantomSegments.map(seg => (
                    <div key={seg.id} className="text-xs text-amber-200 flex items-center gap-2">
                      <SkipForward className="w-3 h-3" />
                      {seg.title} ({seg.start_time} - {seg.end_time})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Step 2: Reconcile Phantoms */}
        {step === 'reconcile' && (
          <div className="space-y-4">
            <p className="text-purple-200 text-sm">
              {language === 'es'
                ? 'Decide qué hacer con los segmentos que fueron "comidos" por el overrun:'
                : 'Decide what to do with segments that were "eaten" by the overrun:'}
            </p>
            
            <div className="space-y-3">
              {reconciledSegments.map(seg => {
                const rigid = seg.flex_score <= 2;
                return (
                  <div key={seg.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{seg.title}</span>
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                          {seg.segment_type}
                        </Badge>
                        {rigid && (
                          <Badge className="bg-red-600 text-white text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {language === 'es' ? 'Rígido' : 'Rigid'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">Flex: {seg.flex_score}/10</span>
                    </div>
                    
                    <RadioGroup
                      value={seg.disposition}
                      onValueChange={(val) => updateReconciled(seg.id, val)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id={`skip-${seg.id}`} />
                        <Label htmlFor={`skip-${seg.id}`} className="text-slate-300 text-sm">
                          {language === 'es' ? 'Omitir' : 'Skip'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="shift" id={`shift-${seg.id}`} />
                        <Label htmlFor={`shift-${seg.id}`} className="text-slate-300 text-sm">
                          {language === 'es' ? 'Mover después' : 'Shift later'}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('finalize')}
                className="border-slate-600 text-slate-300"
              >
                {language === 'es' ? 'Atrás' : 'Back'}
              </Button>
              <Button
                onClick={handleReconcileComplete}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {language === 'es' ? 'Ver Opciones de Cascade' : 'View Cascade Options'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Cascade Options */}
        {step === 'cascade' && (
          <div className="space-y-4">
            {loadingCascade ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="ml-3 text-purple-200">
                  {language === 'es' ? 'Generando opciones...' : 'Generating options...'}
                </span>
              </div>
            ) : (
              <>
                <p className="text-purple-200 text-sm">
                  {language === 'es'
                    ? 'Selecciona cómo rebalancear el tiempo restante:'
                    : 'Select how to rebalance the remaining time:'}
                </p>
                
                <RadioGroup
                  value={selectedCascade?.toString()}
                  onValueChange={(val) => setSelectedCascade(parseInt(val))}
                  className="space-y-3"
                >
                  {cascadeOptions.map((option, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCascade === idx 
                          ? 'bg-purple-900/50 border-purple-500' 
                          : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={() => setSelectedCascade(idx)}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={idx.toString()} id={`cascade-${idx}`} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`cascade-${idx}`} className="text-white font-medium cursor-pointer">
                              {language === 'es' ? option.label_es : option.label}
                            </Label>
                            {option.exceeds_hard_limit && (
                              <Badge className="bg-red-600 text-white text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {language === 'es' ? 'Excede límite' : 'Exceeds limit'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            {language === 'es' ? option.description_es : option.description}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-slate-400">
                              {language === 'es' ? 'Fin proyectado:' : 'Projected end:'}{' '}
                              <span className="text-white font-mono">{option.projected_session_end}</span>
                            </span>
                            <span className="text-green-400">
                              {language === 'es' ? 'Recupera:' : 'Recovers:'} {option.recovery_min}m
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(phantomSegments.length > 0 ? 'reconcile' : 'finalize')}
                    className="border-slate-600 text-slate-300"
                  >
                    {language === 'es' ? 'Atrás' : 'Back'}
                  </Button>
                  <Button
                    onClick={handleApplyCascade}
                    disabled={selectedCascade === null || isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Zap className="w-4 h-4 mr-1" />
                    )}
                    {language === 'es' ? 'Aplicar Cascade' : 'Apply Cascade'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function addMinutes(timeStr, minutes) {
  const m = parseTimeToMinutes(timeStr);
  if (m === null) return timeStr;
  const newM = m + minutes;
  const h = Math.floor(newM / 60) % 24;
  const min = newM % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}