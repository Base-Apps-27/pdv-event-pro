/**
 * Phase 7: Lazy-loaded page imports
 * =================================
 * 
 * Heavy pages are loaded on-demand to reduce initial bundle size.
 * Use with React Suspense for loading states.
 * 
 * Usage:
 * import { LazyReports } from '@/components/utils/lazyPages';
 * <Suspense fallback={<LoadingSpinner />}>
 *   <LazyReports />
 * </Suspense>
 */

import { lazy } from 'react';

// Heavy pages - lazy load to reduce initial bundle
export const LazyReports = lazy(() => import('@/pages/Reports'));
export const LazyCustomServiceBuilder = lazy(() => import('@/pages/CustomServiceBuilder'));
export const LazyWeeklyServiceManager = lazy(() => import('@/pages/WeeklyServiceManager'));
export const LazyEventDetail = lazy(() => import('@/pages/EventDetail'));

// Medium-weight pages - consider lazy loading if bundle grows
export const LazyDirectorConsole = lazy(() => import('@/pages/DirectorConsole'));
export const LazyScheduleImporter = lazy(() => import('@/pages/ScheduleImporter'));