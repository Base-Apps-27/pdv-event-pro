/**
 * useCurrentUser — P1-4 Consolidation (2026-02-12)
 * 
 * Eliminates duplicate `base44.auth.me()` calls scattered across pages.
 * Each page (Events, Dashboard, DirectorConsole, PublicProgramView, People,
 * WeeklyServiceManager, EventDetail) had its own useEffect + useState for user.
 * 
 * This hook uses react-query for:
 * - Deduplication: multiple components mounting simultaneously share one call
 * - Caching: subsequent navigations reuse cached user data
 * - Stale-while-revalidate: user data stays fresh without blocking UI
 * 
 * USAGE:
 *   import { useCurrentUser } from '@/components/utils/useCurrentUser';
 *   const { user, isLoading } = useCurrentUser();
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const { data: user = null, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 10 * 60 * 1000, // 10 minutes — user data rarely changes mid-session
    retry: false, // Don't retry auth failures
  });

  return { user, isLoading };
}