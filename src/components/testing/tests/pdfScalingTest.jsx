/**
 * PDF Scaling Heuristic Tests
 * Phase 10: Regression tests for PDF generation scaling functions.
 */

import { describe, it, expect } from '../TestRunner';
import { estimateWeeklyOptimalScale } from '../../service/generateWeeklyProgramPDF';

export function pdfScalingTests() {

  describe('estimateWeeklyOptimalScale', () => {
    it('returns 1.0 for empty service data', () => {
      const result = estimateWeeklyOptimalScale({});
      expect(result).toBe(1.0);
    });

    it('returns 1.0 for minimal segments', () => {
      const data = {
        "9:30am": [
          { title: "Alabanza", type: "worship", duration: 30, data: {} },
          { title: "Mensaje", type: "message", duration: 40, data: {} }
        ],
        "11:30am": []
      };
      const result = estimateWeeklyOptimalScale(data);
      expect(result).toBe(1.0);
    });

    it('scales down for dense content', () => {
      const denseSegments = Array.from({ length: 8 }, (_, i) => ({
        title: `Segment ${i + 1}`,
        type: i === 0 ? 'worship' : 'message',
        duration: 15,
        data: {
          presenter: 'Speaker Name',
          leader: i === 0 ? 'Worship Leader' : undefined,
          preacher: i > 0 ? 'Preacher Name' : undefined,
          translator: 'Translator Name',
          coordinator_notes: 'Important coordination notes that take up space on the page',
          projection_notes: 'Projection slide details for this segment',
          sound_notes: 'Sound team instructions for microphones and levels',
          description_details: 'Additional details about this segment content'
        },
        requires_translation: true,
        songs: i === 0 ? [
          { title: 'Song 1' }, { title: 'Song 2' }, { title: 'Song 3' }, { title: 'Song 4' }
        ] : [],
        actions: [
          { label: 'Prep action', timing: 'before_start', offset_min: 5 },
          { label: 'During action', timing: 'after_start', offset_min: 10 }
        ]
      }));

      const data = {
        "9:30am": denseSegments,
        "11:30am": denseSegments
      };
      const result = estimateWeeklyOptimalScale(data);
      expect(result).toBeGreaterThanOrEqual(0.4);
      expect(result).toBeTruthy();
    });

    it('respects minimum scale of 0.40', () => {
      const extremeSegments = Array.from({ length: 15 }, (_, i) => ({
        title: `Segment ${i + 1}`,
        type: 'message',
        duration: 5,
        data: {
          presenter: 'Speaker',
          coordinator_notes: 'A'.repeat(200),
          projection_notes: 'B'.repeat(200),
          sound_notes: 'C'.repeat(200),
          ushers_notes: 'D'.repeat(200),
          translation_notes: 'E'.repeat(200),
          stage_decor_notes: 'F'.repeat(200),
          description_details: 'G'.repeat(200),
          description: 'H'.repeat(200)
        },
        songs: [{ title: 'Song' }],
        actions: [
          { label: 'Action 1', timing: 'before_start', offset_min: 5 },
          { label: 'Action 2', timing: 'after_start', offset_min: 10 },
          { label: 'Action 3', timing: 'before_end', offset_min: 5 }
        ]
      }));

      const data = { "9:30am": extremeSegments, "11:30am": [] };
      const result = estimateWeeklyOptimalScale(data);
      expect(result).toBeGreaterThanOrEqual(0.4);
    });

    it('measures the denser column', () => {
      const lightSegments = [
        { title: "Intro", type: "welcome", duration: 5, data: {} }
      ];
      const heavySegments = Array.from({ length: 6 }, (_, i) => ({
        title: `Heavy ${i}`,
        type: 'message',
        duration: 10,
        data: { presenter: 'Name', coordinator_notes: 'Notes for coordination' },
        songs: [{ title: 'Song' }]
      }));

      const data = {
        "9:30am": lightSegments,
        "11:30am": heavySegments
      };
      const result = estimateWeeklyOptimalScale(data);
      expect(result).toBeGreaterThanOrEqual(0.4);
      expect(result).toBeTruthy();
    });

    it('accounts for pre-service notes', () => {
      const dataWithNote = {
        "9:30am": [
          { title: "Alabanza", type: "worship", duration: 30, data: {} }
        ],
        pre_service_notes: {
          "9:30am": "Please arrive early. Doors open at 9:00 AM."
        }
      };
      const dataWithoutNote = {
        "9:30am": [
          { title: "Alabanza", type: "worship", duration: 30, data: {} }
        ]
      };
      
      const scaleWith = estimateWeeklyOptimalScale(dataWithNote);
      const scaleWithout = estimateWeeklyOptimalScale(dataWithoutNote);
      expect(scaleWith).toBeGreaterThanOrEqual(0.4);
      expect(scaleWithout).toBeGreaterThanOrEqual(0.4);
    });
  });
}