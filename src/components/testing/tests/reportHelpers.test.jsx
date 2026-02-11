/**
 * Report Helpers Tests — Phase 3D smoke tests
 * 
 * Tests for functions extracted from Reports.jsx into reportHelpers.js:
 *   - calculateActionTime
 *   - mergePreSessionDetails
 *   - parseHM
 *   - getSegmentActions
 *   - isPrepAction
 */
import { 
  calculateActionTime, 
  mergePreSessionDetails, 
  parseHM, 
  getSegmentActions, 
  isPrepAction 
} from '../../report/reportHelpers';

export function reportHelpersTests() {
  const results = [];

  // ── parseHM ──────────────────────────────────────────────────────

  results.push({
    name: 'parseHM: valid time "09:30" → 570',
    passed: parseHM('09:30') === 570,
  });

  results.push({
    name: 'parseHM: valid time "00:00" → 0',
    passed: parseHM('00:00') === 0,
  });

  results.push({
    name: 'parseHM: valid time "23:59" → 1439',
    passed: parseHM('23:59') === 1439,
  });

  results.push({
    name: 'parseHM: null → POSITIVE_INFINITY',
    passed: parseHM(null) === Number.POSITIVE_INFINITY,
  });

  results.push({
    name: 'parseHM: empty string → POSITIVE_INFINITY',
    passed: parseHM('') === Number.POSITIVE_INFINITY,
  });

  results.push({
    name: 'parseHM: non-time string → POSITIVE_INFINITY',
    passed: parseHM('abc') === Number.POSITIVE_INFINITY,
  });

  // ── getSegmentActions ────────────────────────────────────────────

  results.push({
    name: 'getSegmentActions: returns segment_actions array',
    passed: (() => {
      const actions = [{ label: 'test' }];
      const result = getSegmentActions({ segment_actions: actions });
      return result === actions;
    })(),
  });

  results.push({
    name: 'getSegmentActions: returns empty array for missing field',
    passed: (() => {
      const result = getSegmentActions({});
      return Array.isArray(result) && result.length === 0;
    })(),
  });

  results.push({
    name: 'getSegmentActions: returns empty array for null segment',
    passed: (() => {
      const result = getSegmentActions(null);
      return Array.isArray(result) && result.length === 0;
    })(),
  });

  // ── isPrepAction ─────────────────────────────────────────────────

  results.push({
    name: 'isPrepAction: before_start → true',
    passed: isPrepAction({ timing: 'before_start' }) === true,
  });

  results.push({
    name: 'isPrepAction: after_start → false',
    passed: isPrepAction({ timing: 'after_start' }) === false,
  });

  results.push({
    name: 'isPrepAction: before_end → false',
    passed: isPrepAction({ timing: 'before_end' }) === false,
  });

  results.push({
    name: 'isPrepAction: absolute → false',
    passed: isPrepAction({ timing: 'absolute' }) === false,
  });

  // ── calculateActionTime ──────────────────────────────────────────

  const baseSegment = { start_time: '10:00', end_time: '10:30', duration_min: 30 };

  results.push({
    name: 'calculateActionTime: before_start 5min → 9:55 AM',
    passed: (() => {
      const result = calculateActionTime(baseSegment, { timing: 'before_start', offset_min: 5 });
      return result !== null && result.includes('9:55');
    })(),
  });

  results.push({
    name: 'calculateActionTime: after_start 10min → 10:10 AM',
    passed: (() => {
      const result = calculateActionTime(baseSegment, { timing: 'after_start', offset_min: 10 });
      return result !== null && result.includes('10:10');
    })(),
  });

  results.push({
    name: 'calculateActionTime: before_end 5min → 10:25 AM',
    passed: (() => {
      const result = calculateActionTime(baseSegment, { timing: 'before_end', offset_min: 5 });
      return result !== null && result.includes('10:25');
    })(),
  });

  results.push({
    name: 'calculateActionTime: absolute with time → returns formatted time',
    passed: (() => {
      const result = calculateActionTime(baseSegment, { timing: 'absolute', absolute_time: '11:00' });
      return result !== null && result.includes('11:00');
    })(),
  });

  results.push({
    name: 'calculateActionTime: absolute without time → null',
    passed: calculateActionTime(baseSegment, { timing: 'absolute' }) === null,
  });

  results.push({
    name: 'calculateActionTime: no start_time → null',
    passed: calculateActionTime({}, { timing: 'before_start', offset_min: 5 }) === null,
  });

  results.push({
    name: 'calculateActionTime: unknown timing → null',
    passed: calculateActionTime(baseSegment, { timing: 'unknown' }) === null,
  });

  // ── mergePreSessionDetails ───────────────────────────────────────

  results.push({
    name: 'mergePreSessionDetails: empty array → null',
    passed: mergePreSessionDetails([]) === null,
  });

  results.push({
    name: 'mergePreSessionDetails: null → null',
    passed: mergePreSessionDetails(null) === null,
  });

  results.push({
    name: 'mergePreSessionDetails: single record → returns its fields',
    passed: (() => {
      const result = mergePreSessionDetails([{ music_profile_id: 'mp1', facility_notes: 'notes' }]);
      return result && result.music_profile_id === 'mp1' && result.facility_notes === 'notes';
    })(),
  });

  results.push({
    name: 'mergePreSessionDetails: picks first non-empty for text fields',
    passed: (() => {
      const result = mergePreSessionDetails([
        { id: '1', facility_notes: 'first' },
        { id: '2', facility_notes: 'second' },
      ]);
      return result && result.facility_notes === 'first';
    })(),
  });

  results.push({
    name: 'mergePreSessionDetails: picks earliest time',
    passed: (() => {
      const result = mergePreSessionDetails([
        { id: '1', registration_desk_open_time: '10:00' },
        { id: '2', registration_desk_open_time: '08:30' },
      ]);
      return result && result.registration_desk_open_time === '08:30';
    })(),
  });

  results.push({
    name: 'mergePreSessionDetails: fills from second record if first is empty',
    passed: (() => {
      const result = mergePreSessionDetails([
        { id: '1', general_notes: '' },
        { id: '2', general_notes: 'from second' },
      ]);
      return result && result.general_notes === 'from second';
    })(),
  });

  return results;
}