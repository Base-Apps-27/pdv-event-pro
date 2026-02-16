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
import { generateInstantCascadeOptions } from '@/components/director/cascadeMath';

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
  const [loadingAI, setLoadingAI] = useState(false); // Only for async AI enrichment
  
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
  
  const handleReconcileComplete = () => {
    buildInstantOptions();
  };
  
  /**
   * INSTANT CASCADE (2026-02-16): Generate math-based options client-side in <1ms.
   * AI "Smart Rebalance" available as optional async enrichment via button.
   */
  const buildInstantOptions = () => {
    const drift = calculateDrift();
    const segsForCascade = remainingSegments.map(s => ({
      id: s.id,
      title: s.title,
      segment_type: s.segment_type,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_min: s.duration_min,
      live_status: s.live_status,
    }));
    
    const instantOptions = generateInstantCascadeOptions(
      segsForCascade,
      actualEndTime,
      drift,
      session.planned_end_time
    );
    
    setCascadeOptions(instantOptions);
    setSelectedCascade(instantOptions.length > 0 ? 0 : null);
    setStep('cascade');
  };

  /**
   * ASYNC AI ENRICHMENT: Fetches a "Smart Rebalance" option from the LLM.
   * Non-blocking — director can act on instant options while this loads.
   */
  const fetchAIOption = async () => {
    setLoadingAI(true);
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
        next_major_break_end_time: null,
        cumulative_drift_min: calculateDrift(),
        time_bank_min: 0,
        reconciled_segments: reconciledSegments
      });
      
      if (response.data?.options?.length > 0) {
        // Tag AI options and append to existing instant options
        const aiOptions = response.data.options.map(opt => ({ ...opt, source: 'ai' }));
        setCascadeOptions(prev => [...prev, ...aiOptions]);
        toast.success(language === 'es' 
          ? `${aiOptions.length} opción(es) IA disponibles` 
          : `${aiOptions.length} AI option(s) ready`);
      }
    } catch (err) {
      console.error('AI cascade generation failed (non-critical):', err);
      toast.error(language === 'es' ? 'IA no disponible — usa las opciones instantáneas' : 'AI unavailable — use instant options');
    } finally {
      setLoadingAI(false);
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
      <CardHeader className="pb-2 border-b border-teal-900/30">
        <CardTitle className="text-white flex items-center gap-2">
          <Hand className="w-5 h-5 text-teal-400" />
          {language === 'es' ? 'Hold Activo' : 'Active Hold'}
          <Badge className="bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 border border-teal-500/50 ml-2">{heldSegment.title}</Badge>
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
            <p className="text-slate-300 text-sm">
              {language === 'es'
                ? 'Decide qué hacer con los segmentos que fueron "comidos" por el overrun:'
                : 'Decide what to do with segments that were "eaten" by the overrun:'}
            </p>
            
            <div className="space-y-3">
              {reconciledSegments.map(seg => {
                const rigid = seg.flex_score <= 2;
                return (
                  <div key={seg.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{seg.title}</span>
                        <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                          {seg.segment_type}
                        </Badge>
                        {rigid && (
                          <Badge className="bg-red-900/50 text-red-200 border-red-800 border text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {language === 'es' ? 'Rígido' : 'Rigid'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">Flex: {seg.flex_score}/10</span>
                    </div>
                    
                    <RadioGroup
                      value={seg.disposition}
                      onValueChange={(val) => updateReconciled(seg.id, val)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id={`skip-${seg.id}`} className="border-slate-600 text-teal-500" />
                        <Label htmlFor={`skip-${seg.id}`} className="text-slate-300 text-sm cursor-pointer hover:text-white">
                          {language === 'es' ? 'Omitir' : 'Skip'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="shift" id={`shift-${seg.id}`} className="border-slate-600 text-teal-500" />
                        <Label htmlFor={`shift-${seg.id}`} className="text-slate-300 text-sm cursor-pointer hover:text-white">
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
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {language === 'es' ? 'Atrás' : 'Back'}
              </Button>
              <Button
                onClick={handleReconcileComplete}
                className="bg-teal-600 hover:bg-teal-700 text-white"
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
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                <span className="ml-3 text-slate-300">
                  {language === 'es' ? 'Generando opciones...' : 'Generating options...'}
                </span>
              </div>
            ) : (
              <>
                <p className="text-slate-300 text-sm">
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
                          ? 'bg-teal-950/30 border-teal-500/50' 
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                      onClick={() => setSelectedCascade(idx)}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={idx.toString()} id={`cascade-${idx}`} className="mt-1 border-slate-600 text-teal-500" />
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