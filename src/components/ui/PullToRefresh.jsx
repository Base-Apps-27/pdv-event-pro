/**
 * PullToRefresh.jsx — Site-wide swipe-down-to-refresh for mobile.
 * 2026-03-07: Wraps children and adds a touch-driven pull indicator.
 * Only activates when the page is scrolled to the very top (scrollY ≈ 0).
 * Triggers window.location.reload() on successful pull.
 * Desktop: completely inert (no mouse listeners).
 */
import React, { useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 80; // px to pull before triggering refresh
const MAX_PULL = 120;      // visual cap

export default function PullToRefresh({ children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  const isAtTop = () => window.scrollY <= 1;

  const onTouchStart = useCallback((e) => {
    if (refreshing) return;
    if (!isAtTop()) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (refreshing || startY.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    // Only activate on downward gesture from top
    if (diff <= 0) {
      if (pulling.current) {
        pulling.current = false;
        setPullDistance(0);
      }
      return;
    }

    // Re-check scroll position — user may have started touch at top then scrolled
    if (!isAtTop() && !pulling.current) {
      startY.current = null;
      return;
    }

    pulling.current = true;
    // Dampen the pull for a natural feel
    const dampened = Math.min(diff * 0.5, MAX_PULL);
    setPullDistance(dampened);
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.5); // hold indicator while reloading
      // Small delay so user sees the spinner
      setTimeout(() => window.location.reload(), 300);
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [pullDistance, refreshing]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const showIndicator = pullDistance > 5;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex items-center justify-center"
          style={{ top: Math.max(pullDistance - 36, 8) }}
        >
          <div className={cn(
            "w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center transition-transform",
            refreshing && "animate-spin"
          )}>
            <RefreshCw
              className={cn(
                "w-4.5 h-4.5 text-gray-600",
                progress >= 1 && !refreshing && "text-pdv-teal"
              )}
              style={!refreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
            />
          </div>
        </div>
      )}

      {/* Content gets a slight translateY nudge while pulling for tactile feel */}
      <div
        style={pullDistance > 5 ? { transform: `translateY(${pullDistance * 0.3}px)`, transition: pulling.current ? 'none' : 'transform 0.2s ease-out' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}