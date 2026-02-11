/**
 * Brand Styles — Phase 2 Foundation Code Quality (2026-02-11)
 * 
 * Centralizes PDV brand color constants, gradient styles, and reusable 
 * style objects. Eliminates scattered inline style objects across pages 
 * and components.
 * 
 * Decision: "Extract shared gradient/color constants" — Phase 2 utility extraction.
 * 
 * USAGE:
 *   import { BRAND, tealButtonStyle, greenButtonStyle, gradientStyle } from '@/components/utils/brandStyles';
 *   <Button style={tealButtonStyle}>...</Button>
 *   <div style={gradientStyle}>...</div>
 */

// ── Brand Color Tokens ──────────────────────────────────────────────
export const BRAND = {
  charcoal: '#1A1A1A',
  teal: '#1F8A70',
  green: '#8DC63F',
  lime: '#BDC63F',
  yellow: '#D7DF23',
  // Darker variants for text on gradient backgrounds
  tealDark: '#0F5C4D',
  greenDark: '#4A7C2F',
  limeDark: '#7A8C1A',
};

// ── Gradient Definitions ────────────────────────────────────────────
// Main brand gradient (bright) — used in sidebar active states, headers
export const gradientStyle = {
  background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
};

// Darker gradient — ensures white text contrast (WCAG AA)
export const gradientDarkStyle = {
  background: 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)',
};

// CSS gradient string for use in template literals / CSS-in-JS
export const GRADIENT_CSS = 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)';
export const GRADIENT_DARK_CSS = 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)';

// ── Reusable Button Style Objects ───────────────────────────────────
// Teal solid button (primary action)
export const tealButtonStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };

// Green solid button (secondary action)
export const greenButtonStyle = { backgroundColor: '#8DC63F', color: '#ffffff' };

// Gradient button (hero/CTA actions)
export const gradientButtonStyle = {
  background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  color: '#ffffff',
};

// ── Print Color Definitions ─────────────────────────────────────────
// Used by PDF generators and print CSS — kept here for single source of truth
export const PRINT_COLORS = {
  headerGradient: 'linear-gradient(90deg, #16a34a 0%, #059669 100%)',
  footerGradient: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  segmentTimeRed: '#dc2626',
  nameBlue: '#2563eb',
  namePurple: '#9333ea',
  noteGreen: '#14532d',
  noteGreenBg: '#f0fdf4',
  noteGreenBorder: '#16a34a',
  projectionBlue: '#1e40af',
  projectionBlueBorder: '#2563eb',
  soundRed: '#991b1b',
  soundRedBorder: '#dc2626',
  ushersGreen: '#14532d',
  ushersGreenBorder: '#16a34a',
  translationPurple: '#581c87',
  translationPurpleBorder: '#9333ea',
  stagePink: '#701a75',
  stagePinkBorder: '#c026d3',
  coordinatorYellow: '#78350f',
  coordinatorYellowBg: '#fffdf5',
  coordinatorYellowBorder: '#fef3c7',
};