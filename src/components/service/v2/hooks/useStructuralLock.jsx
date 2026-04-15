/**
 * useStructuralLock.js — Session-level serialization lock for structural operations.
 *
 * 2026-04-15: Created to prevent race conditions between concurrent structural
 * operations (reorder, add, remove) on the same session's segments.
 *
 * Problem: useMoveSegment and useSpecialSegment both modify segment `order` fields.
 * If both fire concurrently (or two rapid moves overlap), they disagree about the
 * current segment list and overwrite each other's order values.
 *
 * Solution: A promise-chain lock per session. Each structural operation awaits
 * the previous one before starting. This is invisible to the user — no save
 * button, no loading state unless the operation is genuinely slow.
 *
 * The lock also exposes `isBusy` so the UI can disable drag handles during saves.
 *
 * Decision: "Structural operations serialized via promise-chain lock" (2026-04-15)
 */

import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Returns a lock object scoped to the component's lifetime.
 * All structural ops (move, add, remove) should wrap their work in `withLock`.
 *
 * @returns {{
 *   withLock: (fn: () => Promise<any>) => Promise<any>,
 *   isBusy: boolean,
 * }}
 */
export function useStructuralLock() {
  // Promise chain — each operation chains onto the previous
  const chainRef = useRef(Promise.resolve());
  const [isBusy, setIsBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Wraps an async function so it waits for any previous structural op to finish.
   * Returns the result of fn(). Errors are re-thrown after releasing the lock.
   */
  const withLock = useCallback(async (fn) => {
    // Chain onto previous operation
    const prev = chainRef.current;
    let resolve;
    // Create a new promise that will be resolved when this op finishes
    chainRef.current = new Promise(r => { resolve = r; });

    // Wait for previous op
    await prev;

    if (mountedRef.current) setIsBusy(true);
    try {
      const result = await fn();
      return result;
    } finally {
      if (mountedRef.current) setIsBusy(false);
      resolve();
    }
  }, []);

  return { withLock, isBusy };
}