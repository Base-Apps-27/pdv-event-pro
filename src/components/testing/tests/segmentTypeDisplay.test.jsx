import { describe, it, expect } from '../TestRunner';
import { getSegmentDisplayConfig, isPresenterEditable, isPresenterOptional } from '../../utils/segmentTypeDisplay';

export function segmentTypeDisplayTests() {
  describe('getSegmentDisplayConfig — Panel rules', () => {
    it('Panel showPresenter is false', () => {
      expect(getSegmentDisplayConfig('Panel').showPresenter).toBe(false);
    });
    it('Panel responsibleField is panel_panelists', () => {
      expect(getSegmentDisplayConfig('Panel').responsibleField).toBe('panel_panelists');
    });
    it('Panel has fallback to panel_moderators', () => {
      expect(getSegmentDisplayConfig('Panel').responsibleFallback).toBe('panel_moderators');
    });
  });

  describe('getSegmentDisplayConfig — Plenaria', () => {
    it('shows presenter as Predicador', () => {
      const config = getSegmentDisplayConfig('Plenaria');
      expect(config.responsibleLabel.es).toBe('Predicador: ');
    });
    it('has secondaryField message_title', () => {
      expect(getSegmentDisplayConfig('Plenaria').secondaryField).toBe('message_title');
    });
  });

  describe('getSegmentDisplayConfig — Alabanza', () => {
    it('shows presenter as Líder', () => {
      expect(getSegmentDisplayConfig('Alabanza').responsibleLabel.es).toBe('Líder: ');
    });
  });

  describe('getSegmentDisplayConfig — Break types', () => {
    it('Break has presenterOptional true', () => {
      expect(getSegmentDisplayConfig('Break').presenterOptional).toBe(true);
    });
    it('Break label is Encargado', () => {
      expect(getSegmentDisplayConfig('Break').responsibleLabel.es).toBe('Encargado: ');
    });
  });

  describe('getSegmentDisplayConfig — special types', () => {
    it('Breakout showPresenter is false', () => {
      expect(getSegmentDisplayConfig('Breakout').showPresenter).toBe(false);
    });
    it('TechOnly showPresenter is false', () => {
      expect(getSegmentDisplayConfig('TechOnly').showPresenter).toBe(false);
    });
    it('unknown type returns default with showPresenter true', () => {
      expect(getSegmentDisplayConfig('FakeType').showPresenter).toBe(true);
    });
  });

  describe('isPresenterEditable', () => {
    it('Alabanza is editable', () => {
      expect(isPresenterEditable('Alabanza')).toBe(true);
    });
    it('Panel is NOT editable', () => {
      expect(isPresenterEditable('Panel')).toBe(false);
    });
    it('Breakout is NOT editable', () => {
      expect(isPresenterEditable('Breakout')).toBe(false);
    });
  });

  describe('isPresenterOptional', () => {
    it('Break is optional', () => {
      expect(isPresenterOptional('Break')).toBe(true);
    });
    it('Plenaria is NOT optional', () => {
      expect(isPresenterOptional('Plenaria')).toBe(false);
    });
  });
}
