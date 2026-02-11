import { describe, it, expect } from '../TestRunner';
import { normalizeSegment, normalizeServiceTeams, getSegmentData, getNormalizedSongs } from '../../utils/segmentDataUtils';

export function segmentDataUtilsTests() {
  describe('normalizeSegment', () => {
    it('returns null for null input', () => {
      expect(normalizeSegment(null)).toBeNull();
    });
    it('returns null for undefined input', () => {
      expect(normalizeSegment(undefined)).toBeNull();
    });
    it('creates data object if missing', () => {
      const result = normalizeSegment({ title: 'Test' });
      expect(result.data).toBeTruthy();
    });
    it('moves root leader into data.leader', () => {
      const result = normalizeSegment({ leader: 'John' });
      expect(result.data.leader).toBe('John');
    });
    it('moves root preacher into data.preacher', () => {
      const result = normalizeSegment({ preacher: 'Maria' });
      expect(result.data.preacher).toBe('Maria');
    });
    it('preserves existing data fields', () => {
      const result = normalizeSegment({ data: { notes: 'Keep me' } });
      expect(result.data.notes).toBe('Keep me');
    });
    it('forces data.songs to array if not array', () => {
      const result = normalizeSegment({ data: { songs: 'not-array' } });
      expect(Array.isArray(result.data.songs)).toBe(true);
      expect(result.data.songs).toHaveLength(0);
    });
    it('preserves existing songs array', () => {
      const result = normalizeSegment({ data: { songs: [{ title: 'A' }] } });
      expect(result.data.songs).toHaveLength(1);
    });
    it('does not mutate original object', () => {
      const original = { leader: 'John' };
      normalizeSegment(original);
      expect(original.data).toBe(undefined);
    });
  });

  describe('normalizeServiceTeams', () => {
    it('returns null for null input', () => {
      expect(normalizeServiceTeams(null)).toBeNull();
    });
    it('converts string coordinators to { main: string }', () => {
      const result = normalizeServiceTeams({ coordinators: 'Maria' });
      expect(result.coordinators.main).toBe('Maria');
    });
    it('converts null field to { main: "" }', () => {
      const result = normalizeServiceTeams({ coordinators: null });
      expect(result.coordinators.main).toBe('');
    });
    it('handles all team fields', () => {
      const result = normalizeServiceTeams({
        coordinators: 'A', ujieres: 'B', sound: 'C', luces: 'D', fotografia: 'E'
      });
      expect(result.coordinators.main).toBe('A');
      expect(result.ujieres.main).toBe('B');
      expect(result.sound.main).toBe('C');
      expect(result.luces.main).toBe('D');
      expect(result.fotografia.main).toBe('E');
    });
  });

  describe('getSegmentData', () => {
    it('returns empty string for null segment', () => {
      expect(getSegmentData(null, 'title')).toBe('');
    });
    it('returns root title for structural field', () => {
      expect(getSegmentData({ title: 'Worship' }, 'title')).toBe('Worship');
    });
    it('structural fields: root takes priority over data', () => {
      expect(getSegmentData({ title: 'Root', data: { title: 'Data' } }, 'title')).toBe('Root');
    });
    it('content fields: data takes priority over root', () => {
      expect(getSegmentData({ leader: 'Root', data: { leader: 'Data' } }, 'leader')).toBe('Data');
    });
    it('falls back to root for content field if data missing', () => {
      expect(getSegmentData({ leader: 'Root' }, 'leader')).toBe('Root');
    });
    it('returns empty string for missing field', () => {
      expect(getSegmentData({ title: 'Test' }, 'nonexistent')).toBe('');
    });
  });

  describe('getNormalizedSongs', () => {
    it('returns empty array for null segment', () => {
      expect(getNormalizedSongs(null)).toHaveLength(0);
    });
    it('returns data.songs if present (canonical)', () => {
      const songs = getNormalizedSongs({ data: { songs: [{ title: 'A' }] } });
      expect(songs).toHaveLength(1);
      expect(songs[0].title).toBe('A');
    });
    it('returns root songs if data.songs missing', () => {
      const songs = getNormalizedSongs({ songs: [{ title: 'B' }] });
      expect(songs).toHaveLength(1);
    });
    it('extracts from flat song_X fields', () => {
      const songs = getNormalizedSongs({
        song_1_title: 'First', song_1_lead: 'Leader1',
        song_2_title: 'Second'
      });
      expect(songs).toHaveLength(2);
      expect(songs[0].title).toBe('First');
      expect(songs[0].lead).toBe('Leader1');
    });
    it('returns empty array for segment with no songs', () => {
      expect(getNormalizedSongs({})).toHaveLength(0);
    });
  });
}
