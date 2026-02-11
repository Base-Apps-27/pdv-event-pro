import { describe, it, expect } from '../TestRunner';
import { normalizeName, normalizeTitle } from '../../utils/textNormalization';

export function textNormalizationTests() {
  describe('normalizeName — basic capitalization', () => {
    it('capitalizes lowercase names', () => {
      expect(normalizeName('john doe')).toBe('John Doe');
    });
    it('lowercases then capitalizes ALL CAPS', () => {
      expect(normalizeName('MARIA GARCIA')).toBe('Maria Garcia');
    });
  });

  describe('normalizeName — title abbreviations', () => {
    it('abbreviates "pastor" to "P."', () => {
      expect(normalizeName('pastor juan perez')).toBe('P. Juan Perez');
    });
    it('abbreviates "pastora" to "P."', () => {
      expect(normalizeName('pastora maria')).toBe('P. Maria');
    });
    it('abbreviates "profeta" to "Pr."', () => {
      expect(normalizeName('profeta carlos')).toBe('Pr. Carlos');
    });
  });

  describe('normalizeName — special characters', () => {
    it('handles apostrophes (O\'Brien)', () => {
      const result = normalizeName("o'brien");
      expect(result).toBe("O'Brien");
    });
    it('handles hyphens (Mary-Jane)', () => {
      expect(normalizeName('mary-jane')).toBe('Mary-Jane');
    });
  });

  describe('normalizeName — separator normalization', () => {
    it('replaces / with comma', () => {
      expect(normalizeName('john / maria')).toBe('John, Maria');
    });
    it('replaces & with comma', () => {
      expect(normalizeName('john & maria')).toBe('John, Maria');
    });
  });

  describe('normalizeName — edge cases', () => {
    it('returns null for null input', () => {
      expect(normalizeName(null)).toBeNull();
    });
    it('returns empty string for empty string', () => {
      expect(normalizeName('')).toBe('');
    });
    it('returns non-string values as-is', () => {
      expect(normalizeName(123)).toBe(123);
    });
    it('trims whitespace', () => {
      expect(normalizeName('  john doe  ')).toBe('John Doe');
    });
  });

  describe('normalizeTitle', () => {
    it('capitalizes title case', () => {
      expect(normalizeTitle('great is our god')).toBe('Great Is Our God');
    });
    it('keeps lowercase words lowercase (except first/last)', () => {
      expect(normalizeTitle('lord of the harvest')).toBe('Lord of the Harvest');
    });
    it('returns null for null', () => {
      expect(normalizeTitle(null)).toBeNull();
    });
    it('returns empty string for whitespace-only', () => {
      expect(normalizeTitle('   ')).toBe('');
    });
  });
}
