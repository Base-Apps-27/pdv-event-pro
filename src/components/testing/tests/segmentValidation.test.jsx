import { describe, it, expect } from '../TestRunner';
import { validateAIActions, VALID_SEGMENT_TYPES, SEGMENT_TYPE_REQUIRED_FIELDS } from '../../utils/segmentValidation';

export function segmentValidationTests() {
  describe('VALID_SEGMENT_TYPES', () => {
    it('has 19 segment types', () => {
      expect(VALID_SEGMENT_TYPES).toHaveLength(19);
    });
    it('includes Alabanza', () => {
      expect(VALID_SEGMENT_TYPES).toContain('Alabanza');
    });
    it('includes Panel', () => {
      expect(VALID_SEGMENT_TYPES).toContain('Panel');
    });
  });

  describe('SEGMENT_TYPE_REQUIRED_FIELDS', () => {
    it('Plenaria requires message_title', () => {
      expect(SEGMENT_TYPE_REQUIRED_FIELDS.Plenaria).toContain('message_title');
    });
    it('Panel requires panel_moderators', () => {
      expect(SEGMENT_TYPE_REQUIRED_FIELDS.Panel).toContain('panel_moderators');
    });
  });

  describe('validateAIActions — empty input', () => {
    it('empty actions array is valid', () => {
      const result = validateAIActions([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateAIActions — create_segments', () => {
    it('valid segment passes', () => {
      const result = validateAIActions([{
        type: 'create_segments',
        create_data: [{ title: 'Test', segment_type: 'Alabanza', number_of_songs: 3 }]
      }]);
      expect(result.isValid).toBe(true);
    });
    it('missing title produces error', () => {
      const result = validateAIActions([{
        type: 'create_segments',
        create_data: [{ segment_type: 'Alabanza' }]
      }]);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
    it('invalid segment_type produces error', () => {
      const result = validateAIActions([{
        type: 'create_segments',
        create_data: [{ title: 'Test', segment_type: 'InvalidType' }]
      }]);
      expect(result.isValid).toBe(false);
    });
    it('Plenaria without message_title produces fixable error', () => {
      const result = validateAIActions([{
        type: 'create_segments',
        create_data: [{ title: 'Sermon', segment_type: 'Plenaria' }]
      }]);
      expect(result.isValid).toBe(false);
      expect(result.fixableErrors.length).toBeGreaterThanOrEqual(1);
      expect(result.fixableErrors[0].field).toBe('message_title');
    });
  });

  describe('validateAIActions — create_sessions', () => {
    it('missing name produces error', () => {
      const result = validateAIActions([{
        type: 'create_sessions',
        create_data: [{ date: '2026-01-15' }]
      }]);
      expect(result.isValid).toBe(false);
    });
    it('missing date produces error', () => {
      const result = validateAIActions([{
        type: 'create_sessions',
        create_data: [{ name: 'Session 1' }]
      }]);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateAIActions — update_segments', () => {
    it('invalid segment_type in changes produces error', () => {
      const result = validateAIActions([{
        type: 'update_segments',
        changes: { segment_type: 'FakeType' }
      }]);
      expect(result.isValid).toBe(false);
    });
    it('empty changes produces warning', () => {
      const result = validateAIActions([{
        type: 'update_segments',
        changes: {}
      }]);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });
}
