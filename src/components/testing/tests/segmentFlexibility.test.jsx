import { describe, it, expect } from '../TestRunner';
import {
  SEGMENT_FLEXIBILITY,
  getSegmentFlexibility,
  isRigidSegment,
  isHighlyCompressible,
  maxCompressMinutes
} from '../../utils/segmentFlexibility';

export function segmentFlexibilityTests() {
  describe('SEGMENT_FLEXIBILITY scores', () => {
    it('Break has score 10 (fully compressible)', () => {
      expect(SEGMENT_FLEXIBILITY.Break.score).toBe(10);
    });
    it('Receso has score 10', () => {
      expect(SEGMENT_FLEXIBILITY.Receso.score).toBe(10);
    });
    it('Video has score 0 (rigid)', () => {
      expect(SEGMENT_FLEXIBILITY.Video.score).toBe(0);
    });
    it('Plenaria has score 2 (rigid)', () => {
      expect(SEGMENT_FLEXIBILITY.Plenaria.score).toBe(2);
    });
    it('Artes has score 1 (rigid)', () => {
      expect(SEGMENT_FLEXIBILITY.Artes.score).toBe(1);
    });
    it('Anuncio has score 7 (highly flexible)', () => {
      expect(SEGMENT_FLEXIBILITY.Anuncio.score).toBe(7);
    });
    it('has entries for all 19 segment types', () => {
      expect(Object.keys(SEGMENT_FLEXIBILITY)).toHaveLength(19);
    });
  });

  describe('getSegmentFlexibility', () => {
    it('returns config for known type', () => {
      const flex = getSegmentFlexibility('Break');
      expect(flex.score).toBe(10);
      expect(flex.skipDefault).toBe('skip');
    });
    it('returns default (score 5) for unknown type', () => {
      const flex = getSegmentFlexibility('UnknownType');
      expect(flex.score).toBe(5);
      expect(flex.skipDefault).toBe('shift');
    });
  });

  describe('isRigidSegment (score <= 2)', () => {
    it('Video is rigid', () => {
      expect(isRigidSegment('Video')).toBe(true);
    });
    it('Artes is rigid', () => {
      expect(isRigidSegment('Artes')).toBe(true);
    });
    it('Plenaria is rigid', () => {
      expect(isRigidSegment('Plenaria')).toBe(true);
    });
    it('Break is NOT rigid', () => {
      expect(isRigidSegment('Break')).toBe(false);
    });
    it('Alabanza (score 4) is NOT rigid', () => {
      expect(isRigidSegment('Alabanza')).toBe(false);
    });
  });

  describe('isHighlyCompressible (score >= 8)', () => {
    it('Break (10) is highly compressible', () => {
      expect(isHighlyCompressible('Break')).toBe(true);
    });
    it('TechOnly (8) is highly compressible', () => {
      expect(isHighlyCompressible('TechOnly')).toBe(true);
    });
    it('Almuerzo (8) is highly compressible', () => {
      expect(isHighlyCompressible('Almuerzo')).toBe(true);
    });
    it('Plenaria (2) is NOT highly compressible', () => {
      expect(isHighlyCompressible('Plenaria')).toBe(false);
    });
  });

  describe('maxCompressMinutes', () => {
    it('Break (score 10) with 20 min = 20', () => {
      expect(maxCompressMinutes('Break', 20)).toBe(20);
    });
    it('Video (score 0) with 10 min = 0', () => {
      expect(maxCompressMinutes('Video', 10)).toBe(0);
    });
    it('Alabanza (score 4) with 15 min = 6 (floor)', () => {
      expect(maxCompressMinutes('Alabanza', 15)).toBe(6);
    });
    it('Anuncio (score 7) with 10 min = 7', () => {
      expect(maxCompressMinutes('Anuncio', 10)).toBe(7);
    });
  });
}
