/**
 * useUserNameResolver.jsx
 * 
 * 2026-04-15: Created to fix denormalized username staleness.
 * 
 * Problem: Several entities store user_name as a snapshot string that goes stale
 * when a user changes their display name. Affected: Session.live_director_user_name,
 * EditActionLog.user_name, LiveOperationsMessage.created_by_name, etc.
 * 
 * Solution: Resolve display names from the User entity at read time using email as key.
 * The stored name becomes a fallback only (for deleted accounts).
 * 
 * Usage:
 *   const { resolveName } = useUserNameResolver(emailList);
 *   const displayName = resolveName(email, storedFallbackName);
 * 
 * Decision: "Resolve usernames at read time from User entity" (2026-04-15)
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Fetches all users once and builds an email→name lookup map.
 * Returns a resolveName(email, fallback) function.
 * 
 * @param {string[]} emails - Optional list of emails to resolve (used for cache key stability).
 *                            If omitted, fetches all users (suitable for admin pages).
 * @returns {{ resolveName: (email: string, fallback?: string) => string, isLoading: boolean }}
 */
export function useUserNameResolver(emails = []) {
  // Fetch all users once (they're cached by React Query).
  // The User entity is typically small (< 200 records in this app).
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['userNameResolver'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,   // 5 min — names don't change often
    cacheTime: 10 * 60 * 1000,  // 10 min cache retention
  });

  // Build email → full_name AND id → full_name maps
  const { nameByEmail, nameById } = useMemo(() => {
    const byEmail = {};
    const byId = {};
    for (const u of users) {
      const name = u.full_name || u.email || 'Unknown';
      if (u.email) byEmail[u.email.toLowerCase()] = name;
      if (u.id) byId[u.id] = name;
    }
    return { nameByEmail: byEmail, nameById: byId };
  }, [users]);

  /**
   * Resolve a display name from email.
   * @param {string} email - User email (the durable key)
   * @param {string} fallback - Stored denormalized name (used if user deleted or not found)
   * @returns {string} Best available display name
   */
  const resolveName = (email, fallback) => {
    if (!email) return fallback || 'Unknown';
    const resolved = nameByEmail[email.toLowerCase()];
    return resolved || fallback || email.split('@')[0] || 'Unknown';
  };

  /**
   * Resolve a display name from user ID (for Session.live_director_user_id, etc.)
   * @param {string} userId - User entity ID
   * @param {string} fallback - Stored denormalized name
   * @returns {string} Best available display name
   */
  const resolveNameById = (userId, fallback) => {
    if (!userId) return fallback || 'Unknown';
    const resolved = nameById[userId];
    return resolved || fallback || 'Unknown';
  };

  return { resolveName, resolveNameById, isLoading };
}