import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for debounced commits with immediate blur support
 * - Auto-commits after delay if no changes
 * - Blur commits immediately and cancels pending timer
 * - Idempotent: only commits if value actually changed
 *
 * SONG-OVERWRITE-FIX-2 (2026-02-20): onCommit is stored in a ref to avoid
 * stale closure issues. The useEffect that schedules the debounced commit
 * no longer captures onCommit in its closure — it reads onCommitRef.current
 * at fire time, ensuring the latest callback is always called.
 */
export function useDebouncedCommit(localValue, currentGlobalValue, onCommit, delay = 3000) {
  const commitTimerRef = useRef(null);
  const lastCommittedRef = useRef(currentGlobalValue);
  const onCommitRef = useRef(onCommit);
  const localValueRef = useRef(localValue);

  // Keep refs current
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { localValueRef.current = localValue; }, [localValue]);

  // Debounced commit on change
  useEffect(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    // Only schedule commit if value actually changed
    if (localValue !== lastCommittedRef.current) {
      commitTimerRef.current = setTimeout(() => {
        // Read from refs at fire time — avoids stale closure
        const currentVal = localValueRef.current;
        onCommitRef.current(currentVal);
        lastCommittedRef.current = currentVal;
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
  const commitNow = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    
    const currentVal = localValueRef.current;
    // Only commit if value actually changed
    if (currentVal !== lastCommittedRef.current) {
      onCommitRef.current(currentVal);
      lastCommittedRef.current = currentVal;
    }
  }, []);

  return commitNow;
}