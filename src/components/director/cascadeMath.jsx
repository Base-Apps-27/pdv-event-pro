/**
 * cascadeMath.js — Client-side instant cascade option generators
 * 
 * DECISION (2026-02-16): "AI cascade proposals are optional enrichment, not the critical path"
 * 
 * These pure functions compute cascade timing options in <1ms using the existing
 * flexibility scores from segmentFlexibility.js. They replace the blocking LLM call
 * for 2 of the 3 cascade options (Shift All, Compress Breaks First).
 * 
 * The AI "Smart Rebalance" option remains available as an async enrichment button
 * but never blocks the director's ability to act.
 * 
 * Affected surfaces: DirectorHoldPanel (consumer)
 * Dependencies: segmentFlexibility.js (scores + maxCompressMinutes)
 */

import { getSegmentFlexibility, maxCompressMinutes } from '@/components/utils/segmentFlexibility';

// ── Helpers ──

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(totalMin) {
  const h = Math.floor(((totalMin % 1440) + 1440) % 1440 / 60);
  const m = ((totalMin % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Option 1: Shift All
 * Simply push all remaining segments forward by the drift amount.
 * No compression — fastest, most predictable, session ends late.
 */
export function buildShiftAllOption(remainingSegments, actualEndTime, driftMin, sessionPlannedEnd) {
  const startMin = parseTimeToMinutes(actualEndTime);
  if (startMin === null) return null;

  let cursor = startMin;
  const segments = remainingSegments.map(seg => {
    const duration = seg.duration_min || 0;
    const newStart = minutesToHHMM(cursor);
    const newEnd = minutesToHHMM(cursor + duration);
    const result = {
      id: seg.id,
      new_start_time: newStart,
      new_end_time: newEnd,
      new_duration_min: duration,
      delta_min: 0, // No compression
    };
    cursor += duration;
    return result;
  });

  const projectedEnd = minutesToHHMM(cursor);
  const sessionEndMin = parseTimeToMinutes(sessionPlannedEnd);
  const exceeds = sessionEndMin !== null && cursor > sessionEndMin;

  return {
    label: 'Shift All',
    label_es: 'Desplazar Todo',
    description: `Push all segments forward by ${driftMin} min. No content cut. Session ends ${driftMin} min late.`,
    description_es: `Desplazar todos los segmentos ${driftMin} min. Sin recorte. Sesión termina ${driftMin} min tarde.`,
    segments,
    projected_session_end: projectedEnd,
    exceeds_hard_limit: exceeds,
    recovery_min: 0,
    source: 'math', // Tag as instant/client-side
  };
}

/**
 * Option 2: Compress Breaks First
 * Absorb drift by compressing segments in flexibility-score order (highest first).
 * Uses maxCompressMinutes to cap compression per segment.
 * Falls back to partial recovery if drift exceeds total compressible time.
 */
export function buildCompressBreaksOption(remainingSegments, actualEndTime, driftMin, sessionPlannedEnd) {
  const startMin = parseTimeToMinutes(actualEndTime);
  if (startMin === null) return null;

  let toRecover = Math.max(0, driftMin);

  // Build compression plan: sort by flex score DESC, apply compression greedily
  const compressionPlan = remainingSegments.map(seg => {
    const flex = getSegmentFlexibility(seg.segment_type);
    const maxCompress = maxCompressMinutes(seg.segment_type, seg.duration_min || 0);
    return {
      ...seg,
      flexScore: flex.score,
      maxCompress,
      appliedCompress: 0,
    };
  });

  // Sort by flexibility (highest first) for compression allocation
  const sortedForCompression = [...compressionPlan].sort((a, b) => b.flexScore - a.flexScore);

  // Greedy allocation: take from most flexible first
  for (const seg of sortedForCompression) {
    if (toRecover <= 0) break;
    const take = Math.min(seg.maxCompress, toRecover);
    seg.appliedCompress = take;
    toRecover -= take;
  }

  const totalRecovered = driftMin - toRecover;

  // Now build the timeline in original order using the compression plan
  let cursor = startMin;
  const segments = compressionPlan.map(seg => {
    const newDuration = Math.max(0, (seg.duration_min || 0) - seg.appliedCompress);
    const newStart = minutesToHHMM(cursor);
    const newEnd = minutesToHHMM(cursor + newDuration);
    const result = {
      id: seg.id,
      new_start_time: newStart,
      new_end_time: newEnd,
      new_duration_min: newDuration,
      delta_min: -seg.appliedCompress,
    };
    cursor += newDuration;
    return result;
  });

  const projectedEnd = minutesToHHMM(cursor);
  const sessionEndMin = parseTimeToMinutes(sessionPlannedEnd);
  const exceeds = sessionEndMin !== null && cursor > sessionEndMin;

  const fullyRecovered = toRecover <= 0;
  const description = fullyRecovered
    ? `Compress flexible segments to recover all ${driftMin} min. Session ends on time.`
    : `Compress flexible segments to recover ${totalRecovered} of ${driftMin} min. ${Math.ceil(toRecover)} min still over.`;
  const descriptionEs = fullyRecovered
    ? `Comprimir segmentos flexibles para recuperar los ${driftMin} min. Sesión termina a tiempo.`
    : `Comprimir segmentos flexibles para recuperar ${totalRecovered} de ${driftMin} min. ${Math.ceil(toRecover)} min aún excedidos.`;

  return {
    label: 'Compress Breaks First',
    label_es: 'Comprimir Recesos Primero',
    description,
    description_es: descriptionEs,
    segments,
    projected_session_end: projectedEnd,
    exceeds_hard_limit: exceeds,
    recovery_min: totalRecovered,
    source: 'math',
  };
}

/**
 * Generate all instant (non-AI) cascade options.
 * Returns an array of 2 options ready for DirectorHoldPanel consumption.
 */
export function generateInstantCascadeOptions(remainingSegments, actualEndTime, driftMin, sessionPlannedEnd) {
  const options = [];

  const shiftAll = buildShiftAllOption(remainingSegments, actualEndTime, driftMin, sessionPlannedEnd);
  if (shiftAll) options.push(shiftAll);

  const compressBreaks = buildCompressBreaksOption(remainingSegments, actualEndTime, driftMin, sessionPlannedEnd);
  if (compressBreaks) options.push(compressBreaks);

  return options;
}