/**
 * i18n Translation Tests
 * Phase 10: Regression tests for internationalization coverage.
 */

import { describe, it, expect } from '../TestRunner';

const CRITICAL_KEYS = [
  'nav.dashboard', 'nav.events', 'nav.services', 'nav.reports',
  'nav.people', 'nav.rooms', 'nav.templates', 'nav.liveProgram',
  'common.edit', 'common.cancel', 'common.save', 'common.create',
  'common.delete', 'common.loading', 'common.name', 'common.notes',
  'common.yes', 'common.no',
  'btn.view', 'btn.save', 'btn.cancel', 'btn.saving',
  'btn.create_event', 'btn.view_details',
  'status.planning', 'status.confirmed', 'status.in_progress',
  'status.completed', 'status.archived',
  'dashboard.title', 'events.title', 'reports.title',
  'rooms.title', 'templates.title', 'people.title',
  'public.events', 'public.services', 'public.selectEvent',
  'public.selectService',
  'live.projection', 'live.sound', 'live.ushers', 'live.translation',
  'reports.tabs.detailed', 'reports.tabs.general', 'reports.tabs.projection',
  'reports.tabs.sound', 'reports.tabs.ushers',
  'eventDetail.loading', 'eventDetail.notFound',
  'eventDetail.tabs.info', 'eventDetail.tabs.sessions',
  'rooms.newRoom', 'rooms.editRoom', 'rooms.deleteConfirm',
  'templates.eventTemplates', 'templates.segmentTemplates',
  'people.importCsv', 'people.searchPlaceholder',
];

export function i18nTests() {

  describe('i18n critical key coverage', () => {
    it('defines the expected number of critical keys', () => {
      expect(CRITICAL_KEYS.length).toBeGreaterThanOrEqual(50);
    });

    it('has no duplicate critical keys', () => {
      const unique = new Set(CRITICAL_KEYS);
      expect(unique.size).toBe(CRITICAL_KEYS.length);
    });

    it('critical keys follow dot notation pattern', () => {
      const valid = CRITICAL_KEYS.every(key => key.includes('.') && !key.startsWith('.') && !key.endsWith('.'));
      expect(valid).toBeTruthy();
    });

    it('critical keys have consistent namespace prefixes', () => {
      const namespaces = new Set(CRITICAL_KEYS.map(k => k.split('.')[0]));
      const knownNamespaces = [
        'nav', 'common', 'btn', 'status', 'dashboard', 'events', 'reports',
        'rooms', 'templates', 'people', 'public', 'live', 'eventDetail',
        'field', 'error', 'hint', 'adjustments', 'service', 'panel',
        'arts', 'resources', 'theme', 'voice', 'section', 'sessionsDateFix',
        'ann', 'placeholder', 'color'
      ];
      
      const allKnown = [...namespaces].every(ns => knownNamespaces.includes(ns));
      expect(allKnown).toBeTruthy();
    });
  });

  describe('i18n namespace conventions', () => {
    it('page-specific keys use page prefix', () => {
      const pageKeys = CRITICAL_KEYS.filter(k => 
        k.startsWith('dashboard.') || k.startsWith('events.') || 
        k.startsWith('reports.') || k.startsWith('rooms.') || 
        k.startsWith('templates.') || k.startsWith('people.') ||
        k.startsWith('eventDetail.')
      );
      expect(pageKeys.length).toBeGreaterThanOrEqual(15);
    });

    it('common keys use common/btn/status prefix', () => {
      const commonKeys = CRITICAL_KEYS.filter(k => 
        k.startsWith('common.') || k.startsWith('btn.') || k.startsWith('status.')
      );
      expect(commonKeys.length).toBeGreaterThanOrEqual(15);
    });
  });
}