import { describe, it, expect } from '../TestRunner';
import {
  PERMISSION_HIERARCHY,
  DEFAULT_ROLE_PERMISSIONS,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions
} from '../../utils/permissions';

export function permissionsTests() {
  describe('PERMISSION_HIERARCHY', () => {
    it('view is level 0', () => {
      expect(PERMISSION_HIERARCHY.view).toBe(0);
    });
    it('manage is level 4', () => {
      expect(PERMISSION_HIERARCHY.manage).toBe(4);
    });
    it('access equals manage (level 4)', () => {
      expect(PERMISSION_HIERARCHY.access).toBe(4);
    });
    it('delete is level 3', () => {
      expect(PERMISSION_HIERARCHY.delete).toBe(3);
    });
  });

  describe('DEFAULT_ROLE_PERMISSIONS', () => {
    it('Admin has manage_users', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.Admin).toContain('manage_users');
    });
    it('EventDayViewer only has view_live_program', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.EventDayViewer).toHaveLength(1);
      expect(DEFAULT_ROLE_PERMISSIONS.EventDayViewer).toContain('view_live_program');
    });
  });

  describe('getUserPermissions', () => {
    it('returns empty array for null user', () => {
      expect(getUserPermissions(null)).toHaveLength(0);
    });
    it('returns Admin permissions for admin user', () => {
      const perms = getUserPermissions({ app_role: 'Admin' });
      expect(perms).toContain('manage_users');
      expect(perms).toContain('view_events');
    });
    it('defaults to EventDayViewer if no role', () => {
      const perms = getUserPermissions({});
      expect(perms).toContain('view_live_program');
      expect(perms).toHaveLength(1);
    });
    it('adds custom_permissions', () => {
      const perms = getUserPermissions({
        app_role: 'EventDayViewer',
        custom_permissions: ['edit_events']
      });
      expect(perms).toContain('edit_events');
      expect(perms).toContain('view_live_program');
    });
    it('removes revoked_permissions', () => {
      const perms = getUserPermissions({
        app_role: 'Admin',
        revoked_permissions: ['delete_events']
      });
      expect(perms).toContain('view_events');
      const hasDeleteEvents = perms.includes('delete_events');
      expect(hasDeleteEvents).toBe(false);
    });
  });

  describe('hasPermission — direct match', () => {
    it('admin has view_events', () => {
      expect(hasPermission({ app_role: 'Admin' }, 'view_events')).toBe(true);
    });
    it('viewer does NOT have edit_events', () => {
      expect(hasPermission({ app_role: 'EventDayViewer' }, 'edit_events')).toBe(false);
    });
    it('returns false for null user', () => {
      expect(hasPermission(null, 'view_events')).toBe(false);
    });
  });

  describe('hasPermission — hierarchy', () => {
    it('user with create_events can view_events (level 2 >= 0)', () => {
      expect(hasPermission(
        { app_role: 'EventDayViewer', custom_permissions: ['create_events'] },
        'view_events'
      )).toBe(true);
    });
    it('user with view_events cannot delete_events (level 0 < 3)', () => {
      expect(hasPermission(
        { app_role: 'EventDayViewer', custom_permissions: ['view_events'] },
        'delete_events'
      )).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true if user has any of the listed permissions', () => {
      expect(hasAnyPermission(
        { app_role: 'EventDayViewer' },
        ['view_live_program', 'manage_users']
      )).toBe(true);
    });
    it('returns false if user has none', () => {
      expect(hasAnyPermission(
        { app_role: 'EventDayViewer' },
        ['manage_users', 'delete_events']
      )).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true if user has all listed permissions', () => {
      expect(hasAllPermissions(
        { app_role: 'Admin' },
        ['view_events', 'edit_events']
      )).toBe(true);
    });
    it('returns false if missing any', () => {
      expect(hasAllPermissions(
        { app_role: 'EventDayViewer' },
        ['view_live_program', 'manage_users']
      )).toBe(false);
    });
  });
}
