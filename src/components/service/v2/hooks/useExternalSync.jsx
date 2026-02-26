/**
 * useExternalSync.js — V2 concurrent editing detection.
 * DECISION-003: Clean implementation, no race condition hacks.
 *
 * Subscribes to Service entity changes. If another user modifies the
 * service, shows a reload banner. Suppresses own writes using a
 * timestamp-based window (8s) to avoid false positives.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * @param {string} serviceId - Service entity ID to watch
 * @param {string[]} queryKey - React Query key to invalidate on reload
 * @returns {{ externalChangeAvailable: boolean, handleReload: () => void, markOwnWrite: () => void }}
 */
export function useExternalSync(serviceId, queryKey) {
  const queryClient = useQueryClient();
  const [externalChangeAvailable, setExternalChangeAvailable] = useState(false);
  const lastOwnWriteRef = useRef(0);

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

    let debounceTimer = null;
    const unsub = base44.entities.Service.subscribe((event) => {
      if (event.id !== serviceId) return;
      // Suppress if we wrote recently (8s window covers full round-trip)
      if (Date.now() - lastOwnWriteRef.current < 8000) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Double-check after debounce
        if (Date.now() - lastOwnWriteRef.current < 8000) return;
        setExternalChangeAvailable(true);
        toast.info('Programa actualizado por otro administrador');
      }, 2000);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof unsub === 'function') unsub();
    };
  }, [serviceId]);

  return { externalChangeAvailable, handleReload, markOwnWrite };
}