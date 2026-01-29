// PDF Theme System — Centralized styling for all event reports
// Used by generateEventReportsPDFClient.js and future renderers

export const pdfTheme = {
  // Font sizing (compact for PDF)
  fontSize: {
    xs: 6,
    sm: 6.5,
    base: 7,
    lg: 8,
    xl: 9,
    header: 10,
    title: 12,
  },

  // Colors by segment type (matches web UI)
  segmentColors: {
    alabanza: { hex: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
    bienvenida: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    ofrenda: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    plenaria: { hex: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
    artes: { hex: '#BE185D', bg: '#FDF2F8', border: '#F0ABFC' },
    panel: { hex: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
    video: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    dinamica: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    cierre: { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
    receso: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    mc: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    almuerzo: { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
    breakout: { hex: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    default: { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  },

  // Callout / label styling (notes lane)
  labels: {
    prep: {
      bg: '#FEF3C7',
      text: '#92400E',
      badge: '#F59E0B',
      badgeText: '#FFFFFF',
      icon: '⚠',
    },
    durante: {
      bg: '#DBEAFE',
      text: '#1E40AF',
      badge: '#3B82F6',
      badgeText: '#FFFFFF',
      icon: '▶',
    },
    sonido: {
      bg: '#FEE2E2',
      text: '#991B1B',
      badge: '#DC2626',
      badgeText: '#FFFFFF',
    },
    trad: {
      bg: '#F3E8FF',
      text: '#7C3AED',
      badge: '#A78BFA',
      badgeText: '#FFFFFF',
    },
    video: {
      bg: '#DBEAFE',
      text: '#1E40AF',
      badge: '#3B82F6',
      badgeText: '#FFFFFF',
    },
    ujier: {
      bg: '#DCFCE7',
      text: '#166534',
      badge: '#22C55E',
      badgeText: '#FFFFFF',
    },
    stage: {
      bg: '#F3E8FF',
      text: '#7C3AED',
      badge: '#A78BFA',
      badgeText: '#FFFFFF',
    },
  },

  // Spacing / padding (tight)
  spacing: {
    cellPadding: [2, 2, 2, 2], // [top, right, bottom, left]
    rowGap: 0.5,
    textMarginBottom: 0.5,
  },

  // Borders (thin, light gray)
  borders: {
    color: '#D1D5DB',
    width: 0.5,
    lightColor: '#E5E7EB',
  },

  // Text colors
  text: {
    primary: '#111827',
    secondary: '#374151',
    muted: '#6B7280',
    light: '#9CA3AF',
  },

  // Backgrounds
  fills: {
    timeCell: '#F9FAFB',
    notesCell: '#F0F1F3',
    header: '#F3F4F6',
  },
};

// Get color for a segment type (normalized)
export function getSegmentColor(segmentType) {
  if (!segmentType) return pdfTheme.segmentColors.default;
  const normalized = (segmentType || '')
    .toLowerCase()
    .replace(/[áéíóú]/g, a => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[a]));
  return pdfTheme.segmentColors[normalized] || pdfTheme.segmentColors.default;
}

// Get label styling for a note type
export function getLabelStyle(labelKey) {
  const key = (labelKey || '').toLowerCase();
  return pdfTheme.labels[key] || pdfTheme.labels.prep;
}

// Time formatting helper
export function toESTTimeStr(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '—';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}