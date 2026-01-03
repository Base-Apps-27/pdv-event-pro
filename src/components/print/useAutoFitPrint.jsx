import { useState, useEffect, useRef } from 'react';

/**
 * Auto-Fit Print Hook
 * 
 * PURPOSE: Automatically adjusts font scaling to fit content on a single letter-size page (8.5" x 11")
 * before triggering window.print(). Designed for Safari/browser print reliability.
 * 
 * ALGORITHM:
 * 1. Starts with stored print_settings or DEFAULT_SETTINGS
 * 2. Measures rendered content height vs target page height (accounting for fixed header/footer)
 * 3. Iteratively reduces bodyFontScale first (primary adjustment), then titleFontScale if needed
 * 4. Stops when content fits OR reaches minimum scales (0.5 for both)
 * 5. Calls window.print() after fitting completes
 * 
 * CONSTRAINTS:
 * - Letter page: 11" height (1056px at 96dpi)
 * - Fixed header: ~65px (not scaled)
 * - Fixed footer: ~24px (not scaled)
 * - Adjustable content area: ~967px available
 * - Reduction step: 0.02 per iteration (2% decrease)
 * - Max iterations: 25
 * - Min scale: 0.5 (50% of original size)
 * 
 * @param {Object} contentRef - React ref to the content container to measure
 * @param {Object} initialSettings - Starting print settings from service.print_settings_pageX or defaults
 * @param {Function} onPrintComplete - Optional callback after print dialog opens
 * @returns {Object} { loading, settings, error }
 */
export function useAutoFitPrint(contentRef, initialSettings, onPrintComplete) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState(null);
  const hasTriggeredPrint = useRef(false);

  // Letter page dimensions at 96 DPI
  const PAGE_HEIGHT_PX = 11 * 96; // 1056px
  const HEADER_HEIGHT_PX = 65;
  const FOOTER_HEIGHT_PX = 24;
  
  /**
   * Calculate available content height based on margins
   * Margins reduce the usable page space
   */
  const getAvailableContentHeight = (margins) => {
    const marginTopPx = parseMargin(margins.top);
    const marginBottomPx = parseMargin(margins.bottom);
    
    return PAGE_HEIGHT_PX - marginTopPx - marginBottomPx - HEADER_HEIGHT_PX - FOOTER_HEIGHT_PX;
  };

  /**
   * Convert margin string (e.g., "0.5in") to pixels
   */
  const parseMargin = (marginStr) => {
    if (!marginStr) return 0;
    const value = parseFloat(marginStr);
    if (marginStr.includes('in')) return value * 96;
    if (marginStr.includes('cm')) return value * 37.8;
    if (marginStr.includes('mm')) return value * 3.78;
    if (marginStr.includes('pt')) return value * 1.33;
    return value;
  };

  /**
   * Wait for DOM to settle and fonts to load
   * Critical for accurate measurements
   */
  const waitForRender = async () => {
    // Double requestAnimationFrame ensures layout is complete
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    
    // Wait for fonts if API exists (Safari/Chrome support)
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    
    // Additional small delay for Safari stability
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  /**
   * Core auto-fit algorithm
   * Iteratively reduces font scales until content fits or minimum reached
   */
  const autoFit = async () => {
    try {
      setLoading(true);
      
      if (!contentRef.current) {
        console.error('[AUTO-FIT] Content ref is null');
        setError('Content reference not found');
        setLoading(false);
        return;
      }

      const targetHeight = getAvailableContentHeight(settings.margins);
      console.log('[AUTO-FIT] Starting auto-fit', {
        targetHeight,
        margins: settings.margins,
        initialBodyScale: settings.bodyFontScale,
        initialTitleScale: settings.titleFontScale
      });

      let currentBodyScale = settings.bodyFontScale;
      let currentTitleScale = settings.titleFontScale;
      let iteration = 0;
      const MAX_ITERATIONS = 25;
      const SCALE_STEP = 0.02; // 2% reduction per step
      const MIN_SCALE = 0.5;   // Don't go below 50%

      while (iteration < MAX_ITERATIONS) {
        // Apply current scales
        setSettings(prev => ({
          ...prev,
          bodyFontScale: currentBodyScale,
          titleFontScale: currentTitleScale
        }));

        // Wait for DOM to update with new scales
        await waitForRender();

        // Measure content height
        const contentHeight = contentRef.current.scrollHeight;
        
        console.log(`[AUTO-FIT] Iteration ${iteration + 1}:`, {
          contentHeight,
          targetHeight,
          fits: contentHeight <= targetHeight,
          bodyScale: currentBodyScale.toFixed(2),
          titleScale: currentTitleScale.toFixed(2)
        });

        // Check if content fits
        if (contentHeight <= targetHeight) {
          console.log('[AUTO-FIT] ✓ Content fits! Final scales:', {
            bodyFontScale: currentBodyScale.toFixed(2),
            titleFontScale: currentTitleScale.toFixed(2)
          });
          break;
        }

        // Reduce bodyFontScale first (prioritize body text reduction)
        if (currentBodyScale > MIN_SCALE) {
          currentBodyScale = Math.max(MIN_SCALE, currentBodyScale - SCALE_STEP);
        }
        // If body is at minimum, start reducing title
        else if (currentTitleScale > MIN_SCALE) {
          currentTitleScale = Math.max(MIN_SCALE, currentTitleScale - SCALE_STEP);
        }
        // Both at minimum, cannot fit
        else {
          console.warn('[AUTO-FIT] ⚠ Cannot fit content even at minimum scales', {
            contentHeight,
            targetHeight,
            overflow: contentHeight - targetHeight
          });
          setError('Content too large to fit on one page');
          break;
        }

        iteration++;
      }

      if (iteration >= MAX_ITERATIONS) {
        console.warn('[AUTO-FIT] ⚠ Reached max iterations without fitting');
        setError('Auto-fit reached maximum iterations');
      }

      // Final wait before printing
      await waitForRender();
      
      setLoading(false);

      // Trigger print dialog
      if (!hasTriggeredPrint.current) {
        hasTriggeredPrint.current = true;
        
        console.log('[AUTO-FIT] Triggering print dialog...');
        
        // Small delay to ensure loading state clears visually
        setTimeout(() => {
          window.print();
          
          // Optional: auto-close tab after print dialog closes (best-effort)
          // Safari may block this, but try anyway
          if (onPrintComplete) {
            window.addEventListener('afterprint', () => {
              onPrintComplete();
            }, { once: true });
          }
        }, 100);
      }

    } catch (err) {
      console.error('[AUTO-FIT] Error during auto-fit:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Run auto-fit on mount
  useEffect(() => {
    autoFit();
  }, []); // Only run once on mount

  return { loading, settings, error };
}