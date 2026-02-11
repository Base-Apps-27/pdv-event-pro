import { describe, it, expect } from '../TestRunner';
import { formatTimeToEST, format24HourTime, formatDateET } from '../../utils/timeFormat';

export function timeFormatTests() {
  describe('formatTimeToEST', () => {
    it('converts 14:30 to 2:30 PM', () => {
      expect(formatTimeToEST('14:30')).toBe('2:30 PM');
    });
    it('converts 00:00 to 12:00 AM (midnight)', () => {
      expect(formatTimeToEST('00:00')).toBe('12:00 AM');
    });
    it('converts 12:00 to 12:00 PM (noon)', () => {
      expect(formatTimeToEST('12:00')).toBe('12:00 PM');
    });
    it('converts 09:05 to 9:05 AM', () => {
      expect(formatTimeToEST('09:05')).toBe('9:05 AM');
    });
    it('converts 23:59 to 11:59 PM', () => {
      expect(formatTimeToEST('23:59')).toBe('11:59 PM');
    });
    it('returns empty string for null', () => {
      expect(formatTimeToEST(null)).toBe('');
    });
    it('returns empty string for empty string', () => {
      expect(formatTimeToEST('')).toBe('');
    });
    it('returns empty string for undefined', () => {
      expect(formatTimeToEST(undefined)).toBe('');
    });
  });

  describe('format24HourTime (alias)', () => {
    it('delegates to formatTimeToEST', () => {
      expect(format24HourTime('19:30')).toBe('7:30 PM');
    });
  });

  describe('formatDateET', () => {
    it('reformats YYYY-MM-DD to MM-DD-YYYY', () => {
      expect(formatDateET('2026-01-15')).toBe('01-15-2026');
    });
    it('reformats 2026-12-31', () => {
      expect(formatDateET('2026-12-31')).toBe('12-31-2026');
    });
    it('returns empty string for null', () => {
      expect(formatDateET(null)).toBe('');
    });
    it('returns empty string for empty string', () => {
      expect(formatDateET('')).toBe('');
    });
    it('returns empty string for invalid date', () => {
      expect(formatDateET('not-a-date')).toBe('');
    });
  });
}
