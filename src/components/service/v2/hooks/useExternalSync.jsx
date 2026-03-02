/**
 * useExternalSync.js — V2 concurrent editing detection.
 *
 * 2026-03-02: Simplified. Only watches the Service entity itself (scoped by ID).
 * Segment/Session subscriptions were firing on ALL entities app-wide, causing
 * constant false "Otro administrador" banners. Removed them.
 *
 * The suppress window is 15s to cover debounced writes that may land late.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SUPPRESS_WINDOW_MS = 15000;
const DEBOUNCE_MS = 3000;

/**
 * @param {string} serviceId - Service entity ID to watch
 * @param {string[]} queryKey - React Query key to invalidate on reload
 * @returns {{ externalChangeAvailable: boolean, handleReload: () => void, markOwnWrite: () => void }}
 */
export function useExternalSync(serviceId, queryKey) {
  const queryClient = useQueryClient();
  const [externalChangeAvailable, setExternalChangeAvailable] = useState(false);
  const lastOwnWriteRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const markOwnWrite = useCallback(() => {
    lastOwnWriteRef.current = Date.now();
  }, []);

  const handleReload = useCallback(() => {
    setExternalChangeAvailable(false);
    queryClient.invalidateQueries({ queryKey });
    toast.info('Recargando programa...');
  }, [queryClient, queryKey]);

  useEffect(() => {
    if (!serviceId) return;

    // Only watch the specific Service entity — no app-wide Segment/Session noise
    const unsub = base44.entities.Service.subscribe((event) => {
      if (event.id !== serviceId) return;
      // Suppress if we wrote recently (own edits)
      if (Date.now() - lastOwnWriteRef.current < SUPPRESS_WINDOW_MS) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (Date.now() - lastOwnWriteRef.current < SUPPRESS_WINDOW_MS) return;
        setExternalChangeAvailable(true);
      }, DEBOUNCE_MS);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (typeof unsub === 'function') unsub();
    };
  }, [serviceId]);

  return { externalChangeAvailable, handleReload, markOwnWrite };
}