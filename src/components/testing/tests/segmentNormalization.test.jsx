import { describe, it, expect } from '../TestRunner';
import { normalizeServiceData, getNormalizedSongs } from '../../utils/segmentNormalization';

export function segmentNormalizationTests() {
  describe('normalizeServiceData — weekly', () => {
    it('extracts segments from time slots', () => {
      const result = normalizeServiceData({
        '9:30am': [{ title: 'A' }],
        '11:30am': [{ title: 'B' }],
        date: '2026-01-15'
      }, 'weekly');
      expect(result).toHaveLength(2);
    });
    it('adds timeSlot to weekly segments', () => {
      const result = normalizeServiceData({
        '9:30am': [{ title: 'A' }],
        date: '2026-01-15'
      }, 'weekly');
      expect(result[0].timeSlot).toBe('9:30am');
    });
    it('adds date to weekly segments', () => {
      const result = normalizeServiceData({
        '9:30am': [{ title: 'A' }],
        date: '2026-01-15'
      }, 'weekly');
      expect(result[0].date).toBe('2026-01-15');
    });
  });

  describe('normalizeServiceData — custom', () => {
    it('extracts from segments array', () => {
      const result = normalizeServiceData({
        segments: [{ title: 'C' }],
        date: '2026-01-15'
      }, 'custom');
      expect(result).toHaveLength(1);
    });
    it('handles missing segments array', () => {
      const result = normalizeServiceData({ date: '2026-01-15' }, 'custom');
      expect(result).toHaveLength(0);
    });
  });

  describe('normalizeServiceData — event', () => {
    it('passes through segments array', () => {
      const result = normalizeServiceData({
        segments: [{ id: 5, title: 'D' }]
      }, 'event');
      expect(result).toHaveLength(1);
    });
    it('entity-backed segments have source "entity"', () => {
      const result = normalizeServiceData({
        segments: [{ id: 5, title: 'D' }]
      }, 'event');
      expect(result[0].source).toBe('entity');
    });
  });

  describe('normalizeServiceData — stable IDs', () => {
    it('json segments (no id) get source "json"', () => {
      const result = normalizeServiceData({
        '9:30am': [{ title: 'No ID' }],
        date: '2026-01-15'
      }, 'weekly');
      expect(result[0].source).toBe('json');
    });
    it('segments with id get source "entity"', () => {
      const result = normalizeServiceData({
        '9:30am': [{ id: 42, title: 'Has ID' }],
        date: '2026-01-15'
      }, 'weekly');
      expect(result[0].source).toBe('entity');
    });
    it('generated IDs include serviceType and date', () => {
      const result = normalizeServiceData({
        '9:30am': [{ title: 'Test' }],
        date: '2026-01-15'
      }, 'weekly');
      const id = String(result[0].id);
      expect(id).toContain('weekly');
      expect(id).toContain('2026-01-15');
    });
  });

  describe('getNormalizedSongs', () => {
    it('returns data.songs if present', () => {
      const songs = getNormalizedSongs({ data: { songs: [{ title: 'X' }] } });
      expect(songs).toHaveLength(1);
    });
    it('returns root songs array as fallback', () => {
      const songs = getNormalizedSongs({ songs: [{ title: 'Y' }] });
      expect(songs).toHaveLength(1);
    });
    it('extracts from flat song_X fields using number_of_songs', () => {
      const songs = getNormalizedSongs({
        number_of_songs: 2,
        song_1_title: 'First',
        song_1_lead: 'Lead1',
        song_2_title: 'Second',
      });
      expect(songs).toHaveLength(2);
      expect(songs[0].title).toBe('First');
    });
  });
}
