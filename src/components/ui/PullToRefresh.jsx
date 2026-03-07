/**
 * PullToRefresh.jsx — Site-wide swipe-down-to-refresh for mobile.
 * 2026-03-07 v2: Redesigned with brand gradient pill indicator, smooth spring feel.
 * Only activates when the page is scrolled to the very top (scrollY ≈ 0).
 * Triggers window.location.reload() on successful pull.
 * Desktop: completely inert (no mouse listeners).
 */
import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 80; // px to pull before triggering refresh
const MAX_PULL = 120;      // visual cap

// Easing: soft cubic ease-out dampen for natural resistance feel
const dampen = (val) => Math.min(val * 0.48, MAX_PULL);

// Animated arc spinner (SVG, no deps)
function ArcSpinner({ progress, spinning }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const dash = spinning ? circ : circ * Math.min(progress, 1);
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className={cn(spinning && "animate-spin")}>
      {/* Track */}
      <circle cx="11" cy="11" r={r} stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
      {/* Arc */}
      <circle
        cx="11" cy="11" r={r}
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25} // start at 12 o'clock
        style={{ transition: spinning ? 'none' : 'stroke-dasharray 0.08s linear' }}
      />
    </svg>
  );
}

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

    if (diff <= 0) {
      if (pulling.current) {
        pulling.current = false;
        setPullDistance(0);
      }
      return;
    }

    if (!isAtTop() && !pulling.current) {
      startY.current = null;
      return;
    }

    pulling.current = true;
    setPullDistance(dampen(diff));
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.55);
      setTimeout(() => window.location.reload(), 400);
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [pullDistance, refreshing]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const isReady = progress >= 1 && !refreshing;
  const showIndicator = pullDistance > 6;

  // Pill slides in from above: starts at -40px, settles at 16px from top
  const pillTop = Math.max(pullDistance * 0.55 - 28, 10);
  // Scale in as it appears
  const pillScale = Math.min(0.6 + progress * 0.4, 1);
  const pillOpacity = Math.min(progress * 2.5, 1);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Pill indicator */}
      {showIndicator && (
        <div
          className="fixed left-1/2 z-[9999] pointer-events-none"
          style={{
            top: pillTop,
            transform: `translateX(-50%) scale(${pillScale})`,
            opacity: pillOpacity,
            transition: pulling.current ? 'none' : 'top 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Brand gradient pill */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
            style={{
              background: isReady || refreshing
                ? 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)'
                : 'linear-gradient(90deg, rgba(15,92,77,0.85) 0%, rgba(74,124,47,0.85) 50%, rgba(122,140,26,0.85) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isReady
                ? '0 4px 20px rgba(31,138,112,0.45)'
                : '0 2px 12px rgba(0,0,0,0.18)',
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <ArcSpinner progress={progress} spinning={refreshing} />
            <span
              className="text-white text-xs font-semibold tracking-wide no-select"
              style={{ fontFamily: "'Inter', sans-serif", textTransform: 'none', letterSpacing: '0.02em' }}
            >
              {refreshing ? 'Refreshing…' : isReady ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Content gets a gentle translateY nudge while pulling */}
      <div
        style={
          pullDistance > 6
            ? {
                transform: `translateY(${pullDistance * 0.28}px)`,
                transition: pulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}