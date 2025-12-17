import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

// ===== UTILITIES =====

// Sanitize text for PDF (handle Spanish chars with Helvetica limitations)
function sanitize(text) {
  if (!text) return '';
  return String(text)
    .replace(/á/g, 'a').replace(/Á/g, 'A')
    .replace(/é/g, 'e').replace(/É/g, 'E')
    .replace(/í/g, 'i').replace(/Í/g, 'I')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ú/g, 'u').replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/¡/g, '!').replace(/¿/g, '?')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U');
}

// Fetch image as base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return `data:image/png;base64,${base64}`;
  } catch (e) {
    return null;
  }
}

// Format date in Spanish
function formatDateSpanish(dateStr) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const date = new Date(dateStr + 'T12:00:00');
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

// Calculate segment time
function calculateSegmentTime(segments, index, startTime) {
  let totalMinutes = 0;
  for (let i = 0; i < index; i++) {
    if (segments[i].type !== 'break' && segments[i].type !== 'ministry') {
      totalMinutes += segments[i].duration || 0;
    }
  }
  const [hours, minutes] = startTime.split(':').map(Number);
  const segmentMinutes = hours * 60 + minutes + totalMinutes;
  const h = Math.floor(segmentMinutes / 60);
  const m = segmentMinutes % 60;
  const period = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

// Strip "CUE:" prefix if already present
function stripCuePrefix(text) {
  if (!text) return '';
  return text.replace(/^CUE:\s*/i, '').trim();
}

// ===== STYLES =====
const STYLES = {
  pageTitle: { size: 20, style: 'bold' },
  sectionTitle: { size: 13, style: 'bold' },
  segmentTitle: { size: 9.5, style: 'bold' },
  body: { size: 8.5, style: 'normal' },
  bodySmall: { size: 8, style: 'normal' },
  cue: { size: 7.5, style: 'italic' },
  footer: { size: 8, style: 'bold' }
};

const COLORS = {
  black: [26, 26, 26],
  gray: [55, 65, 81],
  grayLight: [107, 114, 128],
  red: [181, 55, 55],
  green: [141, 198, 63],
  blue: [31, 95, 140],
  white: [255, 255, 255],
  border: [209, 213, 219]
};

// ===== TWO-COLUMN ENGINE =====
class TwoColumnLayout {
  constructor(doc, config) {
    this.doc = doc;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.margin = config.margin || 36;
    this.gutter = config.gutter || 16;
    this.headerHeight = config.headerHeight || 0;
    this.footerHeight = config.footerHeight || 25;
    this.colWidth = (this.pageWidth - this.margin * 2 - this.gutter) / 2;
    this.col1X = this.margin;
    this.col2X = this.margin + this.colWidth + this.gutter;
    this.maxY = this.pageHeight - this.margin - this.footerHeight;
    this.y = [this.headerHeight, this.headerHeight]; // [col0, col1]
    this.scaleFactor = 1;
  }

  getX(col) {
    return col === 0 ? this.col1X : this.col2X;
  }

  getY(col) {
    return this.y[col];
  }

  addHeight(col, height) {
    this.y[col] += height * this.scaleFactor;
  }

  setY(col, val) {
    this.y[col] = val;
  }

  needsScale() {
    return Math.max(this.y[0], this.y[1]) > this.maxY;
  }

  calculateScale(contentHeights) {
    const maxContent = Math.max(...contentHeights);
    const available = this.maxY - this.headerHeight;
    if (maxContent > available) {
      return Math.max(0.7, available / maxContent);
    }
    return 1;
  }
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, includeAnnouncements } = await req.json();
    const { service, announcements } = serviceData;

    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';
    const logoBase64 = await fetchImageAsBase64(logoUrl);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;

    // ===== PAGE 1: SERVICE ORDER =====
    let headerY = margin;

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, headerY, 45, 45);
    }

    // Title
    doc.setFontSize(STYLES.pageTitle.size);
    doc.setFont('helvetica', STYLES.pageTitle.style);
    doc.setTextColor(...COLORS.black);
    doc.text(sanitize('ORDEN DE SERVICIO'), pageWidth / 2, headerY + 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(sanitize(`Domingo ${formatDateSpanish(selectedDate)}`), pageWidth / 2, headerY + 32, { align: 'center' });

    // Team info
    headerY += 50;
    doc.setDrawColor(...COLORS.border);
    doc.line(margin, headerY, pageWidth - margin, headerY);
    headerY += 10;

    doc.setFontSize(7.5);
    const teamParts = [
      `Coordinador: ${service.coordinators?.['9:30am'] || service.coordinators?.['11:30am'] || '-'}`,
      `Ujier: ${service.ujieres?.['9:30am'] || service.ujieres?.['11:30am'] || '-'}`,
      `Sonido: ${service.sound?.['9:30am'] || '-'}`,
      `Luces: ${service.luces?.['9:30am'] || service.luces?.['11:30am'] || '-'}`
    ];
    doc.text(sanitize(teamParts.join('  |  ')), pageWidth / 2, headerY, { align: 'center' });
    headerY += 16;

    // Column headers
    const layout = new TwoColumnLayout(doc, { margin, gutter: 16, headerHeight: headerY + 20, footerHeight: 50 });

    doc.setFontSize(STYLES.sectionTitle.size);
    doc.setFont('helvetica', STYLES.sectionTitle.style);
    doc.setTextColor(...COLORS.blue);
    doc.text('9:30 A.M.', layout.col1X, headerY);
    doc.text('11:30 A.M.', layout.col2X, headerY);

    doc.setDrawColor(...COLORS.blue);
    doc.setLineWidth(1.5);
    doc.line(layout.col1X, headerY + 4, layout.col1X + 60, headerY + 4);
    doc.line(layout.col2X, headerY + 4, layout.col2X + 65, headerY + 4);

    // Pre-calculate content height for scaling
    const segments930 = (service['9:30am'] || []).filter(s => s.type !== 'break');
    const segments1130 = (service['11:30am'] || []).filter(s => s.type !== 'break');

    // Estimate heights
    const estimateSegmentHeight = (seg) => {
      let h = 14; // title
      if (seg.data?.leader) h += 10;
      if (seg.data?.translator) h += 10;
      if (seg.songs) h += seg.songs.filter(s => s.title).length * 9;
      if (seg.data?.ministry_leader) h += 10;
      if (seg.data?.presenter && !seg.data?.ministry_leader) h += 10;
      if (seg.data?.preacher) h += 10;
      if (seg.data?.title) h += 10;
      if (seg.data?.verse) h += 9;
      if (seg.actions?.length) h += seg.actions.length * 8;
      return h + 5;
    };

    const height1 = segments930.reduce((sum, seg) => sum + estimateSegmentHeight(seg), 0);
    const height2 = segments1130.reduce((sum, seg) => sum + estimateSegmentHeight(seg), 0);
    const scale = layout.calculateScale([height1, height2]);

    // Render segment helper
    const renderSegment = (seg, col, segments, idx, startTimeStr) => {
      const x = layout.getX(col);
      let y = layout.getY(col);
      const segTime = calculateSegmentTime(segments, idx, startTimeStr);
      const lineH = 10 * scale;
      const smallLineH = 8 * scale;

      // Time
      doc.setFontSize(STYLES.segmentTitle.size * scale);
      doc.setFont('helvetica', STYLES.segmentTitle.style);
      doc.setTextColor(...COLORS.red);
      doc.text(segTime, x, y);

      // Title
      doc.setTextColor(...COLORS.black);
      const titleX = x + 48;
      doc.text(sanitize((seg.title || '').toUpperCase()), titleX, y);

      // Duration
      if (seg.duration) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.grayLight);
        doc.setFontSize(STYLES.bodySmall.size * scale);
        const titleWidth = doc.getTextWidth(sanitize((seg.title || '').toUpperCase()));
        doc.text(`(${seg.duration} min)`, titleX + titleWidth + 4, y);
      }

      y += lineH + 2;
      doc.setFontSize(STYLES.body.size * scale);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);

      // Leader
      if (seg.data?.leader) {
        doc.text(sanitize('Dirige: '), x, y);
        doc.setTextColor(...COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitize(seg.data.leader), x + 32, y);
        doc.setTextColor(...COLORS.gray);
        doc.setFont('helvetica', 'normal');
        y += lineH;
      }

      // Translator
      if (seg.data?.translator) {
        doc.text(sanitize('Traduce: '), x, y);
        doc.setTextColor(...COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitize(seg.data.translator), x + 38, y);
        doc.setTextColor(...COLORS.gray);
        doc.setFont('helvetica', 'normal');
        y += lineH;
      }

      // Songs
      if (seg.songs) {
        seg.songs.filter(s => s.title).forEach(s => {
          doc.text(sanitize(`- ${s.title}${s.lead ? ` (${s.lead})` : ''}`), x, y);
          y += smallLineH + 1;
        });
      }

      // Ministry leader
      if (seg.data?.ministry_leader) {
        doc.text(sanitize('Ministracion: '), x, y);
        doc.setTextColor(...COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitize(seg.data.ministry_leader), x + 52, y);
        doc.setTextColor(...COLORS.gray);
        doc.setFont('helvetica', 'normal');
        y += lineH;
      }

      // Presenter
      if (seg.data?.presenter && !seg.data?.ministry_leader) {
        doc.setTextColor(...COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitize(seg.data.presenter), x, y);
        doc.setTextColor(...COLORS.gray);
        doc.setFont('helvetica', 'normal');
        y += lineH;
      }

      // Preacher
      if (seg.data?.preacher) {
        doc.setTextColor(...COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitize(seg.data.preacher), x, y);
        doc.setTextColor(...COLORS.gray);
        doc.setFont('helvetica', 'normal');
        y += lineH;
      }

      // Message title
      if (seg.data?.title) {
        doc.text(sanitize(seg.data.title), x, y);
        y += lineH;
      }

      // Verse
      if (seg.data?.verse) {
        doc.setFontSize(STYLES.bodySmall.size * scale);
        doc.setTextColor(...COLORS.grayLight);
        doc.text(sanitize(seg.data.verse), x, y);
        doc.setFontSize(STYLES.body.size * scale);
        doc.setTextColor(...COLORS.gray);
        y += smallLineH;
      }

      // Actions (cues)
      if (seg.actions?.length) {
        doc.setFontSize(STYLES.cue.size * scale);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        seg.actions.forEach(action => {
          let actionText = stripCuePrefix(action.label);
          if (action.timing === 'before_end') actionText += ` (${action.offset_min} min antes)`;
          doc.text(sanitize(actionText), x, y);
          y += smallLineH;
        });
        doc.setFont('helvetica', 'normal');
      }

      layout.setY(col, y + 4);
    };

    // Render both columns
    segments930.forEach((seg, idx) => renderSegment(seg, 0, service['9:30am'], idx, '9:30'));
    segments1130.forEach((seg, idx) => renderSegment(seg, 1, service['11:30am'], idx, '11:30'));

    // Receso
    const recesoY = Math.max(layout.getY(0), layout.getY(1)) + 10;
    doc.setFillColor(...COLORS.blue);
    doc.rect(margin, recesoY, pageWidth - margin * 2, 26, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('11:00am a 11:30am  -  RECESO', pageWidth / 2, recesoY + 16, { align: 'center' });

    // Footer
    doc.setFillColor(...COLORS.green);
    doc.rect(0, pageHeight - 22, pageWidth, 22, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(STYLES.footer.size);
    doc.text(sanitize('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 8, { align: 'center' });

    // ===== PAGE 2: ANNOUNCEMENTS =====
    if (includeAnnouncements && announcements?.length > 0) {
      doc.addPage();
      let y = margin;

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y, 45, 45);
      }

      // Title
      doc.setFontSize(STYLES.pageTitle.size);
      doc.setFont('helvetica', STYLES.pageTitle.style);
      doc.setTextColor(...COLORS.black);
      doc.text('ANUNCIOS', pageWidth / 2, y + 18, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text(sanitize(`Domingo ${formatDateSpanish(selectedDate)}`), pageWidth / 2, y + 32, { align: 'center' });

      y += 55;

      // Two-column layout for announcements
      const annLayout = new TwoColumnLayout(doc, { margin, gutter: 16, headerHeight: y, footerHeight: 30 });

      // Estimate announcement heights for scaling
      const estimateAnnHeight = (ann) => {
        let h = 16; // title + separator
        if (ann.date_of_occurrence || ann.start_date) h += 12;
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          const lines = doc.splitTextToSize(sanitize(content), annLayout.colWidth - 10);
          h += lines.length * 10;
        }
        if (ann.instructions) {
          const instrLines = doc.splitTextToSize(sanitize(stripCuePrefix(ann.instructions)), annLayout.colWidth - 30);
          h += instrLines.length * 9 + 4;
        }
        return h + 12;
      };

      // Distribute announcements to columns
      const col0Anns = [];
      const col1Anns = [];
      announcements.forEach((ann, i) => {
        if (i % 2 === 0) col0Anns.push(ann);
        else col1Anns.push(ann);
      });

      const height0 = col0Anns.reduce((sum, ann) => sum + estimateAnnHeight(ann), 0);
      const height1 = col1Anns.reduce((sum, ann) => sum + estimateAnnHeight(ann), 0);
      const annScale = annLayout.calculateScale([height0, height1]);

      // Render announcement helper
      const renderAnnouncement = (ann, col) => {
        const x = annLayout.getX(col);
        let cy = annLayout.getY(col);
        const lineH = 10 * annScale;
        const smallLineH = 9 * annScale;

        // Title
        doc.setFontSize(STYLES.segmentTitle.size * annScale);
        doc.setFont('helvetica', STYLES.segmentTitle.style);
        doc.setTextColor(...COLORS.black);
        doc.text(sanitize((ann.title || ann.name || '').toUpperCase()), x, cy);
        cy += 10 * annScale;

        // Separator
        doc.setDrawColor(...COLORS.border);
        doc.line(x, cy - 2, x + annLayout.colWidth - 10, cy - 2);
        cy += 4;

        // Date
        if (ann.date_of_occurrence || ann.start_date) {
          doc.setFontSize(STYLES.body.size * annScale);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.red);
          doc.text(sanitize(ann.date_of_occurrence || ann.start_date), x, cy);
          cy += lineH;
        }

        // Content
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.setFontSize(STYLES.body.size * annScale);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.gray);
          const lines = doc.splitTextToSize(sanitize(content), annLayout.colWidth - 10);
          doc.text(lines, x, cy);
          cy += lines.length * smallLineH;
        }

        // Instructions (CUE)
        if (ann.instructions) {
          cy += 3;
          doc.setFontSize(STYLES.cue.size * annScale);
          doc.setTextColor(...COLORS.grayLight);
          doc.setFont('helvetica', 'bold');
          doc.text('CUE:', x, cy);
          doc.setFont('helvetica', 'italic');
          const instrText = stripCuePrefix(ann.instructions);
          const instrLines = doc.splitTextToSize(sanitize(instrText), annLayout.colWidth - 30);
          doc.text(instrLines, x + 24, cy);
          cy += instrLines.length * (8 * annScale);
        }

        annLayout.setY(col, cy + 10);
      };

      // Render announcements
      col0Anns.forEach(ann => renderAnnouncement(ann, 0));
      col1Anns.forEach(ann => renderAnnouncement(ann, 1));

      // Footer
      doc.setFillColor(...COLORS.green);
      doc.rect(0, pageHeight - 22, pageWidth, 22, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(STYLES.footer.size);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitize('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    // Output
    const pdfOutput = doc.output('arraybuffer');
    return new Response(pdfOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="servicio-${selectedDate}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});