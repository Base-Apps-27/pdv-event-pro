import { useEffect, useRef } from 'react';

/**
 * Hook for debounced commits with immediate blur support
 * - Auto-commits after delay if no changes
 * - Blur commits immediately and cancels pending timer
 * - Idempotent: only commits if value actually changed
 */
export function useDebouncedCommit(localValue, currentGlobalValue, onCommit, delay = 3000) {
  const commitTimerRef = useRef(null);
  const lastCommittedRef = useRef(currentGlobalValue);

  // Debounced commit on change
  useEffect(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    // Only schedule commit if value actually changed
    if (localValue !== lastCommittedRef.current) {
      commitTimerRef.current = setTimeout(() => {
        onCommit(localValue);
        lastCommittedRef.current = localValue;
      }, delay);
    }

    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, [localValue, delay]);

  // Update lastCommittedRef when global value changes externally
  useEffect(() => {
    lastCommittedRef.current = currentGlobalValue;
  }, [currentGlobalValue]);

  // Immediate commit function for blur (cancels pending debounce)
  const commitNow = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    
    // Only commit if value actually changed
    if (localValue !== lastCommittedRef.current) {
      onCommit(localValue);
      lastCommittedRef.current = localValue;
    }
  };

  return commitNow;
}