// useNavPins — manages pinned nav items (up to 3 secondary items surfaced to main rail)
// Reads from user.pinned_nav_items, writes via base44.auth.updateMe.
// 2026-02-16: Created for user-customizable sidebar.

import { useState, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const MAX_PINS = 3;

export default function useNavPins(user) {
  // Current pinned IDs from user entity (graceful fallback for users without the field yet)
  const [pinned, setPinned] = useState(() => {
    const stored = user?.pinned_nav_items;
    return Array.isArray(stored) ? stored.slice(0, MAX_PINS) : [];
  });
  const [saving, setSaving] = useState(false);

  const isPinned = useCallback((itemId) => pinned.includes(itemId), [pinned]);

  const togglePin = useCallback(async (itemId) => {
    let next;
    if (pinned.includes(itemId)) {
      // Unpin
      next = pinned.filter(id => id !== itemId);
    } else {
      // Pin — enforce max
      if (pinned.length >= MAX_PINS) return; // silently reject if full
      next = [...pinned, itemId];
    }
    setPinned(next);
    setSaving(true);
    await base44.auth.updateMe({ pinned_nav_items: next });
    setSaving(false);
  }, [pinned]);

  const canPin = useMemo(() => pinned.length < MAX_PINS, [pinned]);

  return { pinned, isPinned, togglePin, canPin, saving, MAX_PINS };
}