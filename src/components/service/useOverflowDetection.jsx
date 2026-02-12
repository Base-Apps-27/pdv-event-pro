/**
 * useOverflowDetection — Extracted from WeeklyServiceManager (Phase 3A).
 * Pure helper functions for estimating print-page overflow risk.
 * Not a hook per se, but grouped for clarity. No React dependencies.
 */

/**
 * Estimates whether the two-column service program will overflow a single printed page.
 * @param {Object} serviceData — full service data object
 * @returns {{ hasOverflow: boolean, level: string, label?: string, color?: string }}
 */
export function calculateServiceProgramOverflow(serviceData) {
  if (!serviceData) return { hasOverflow: false, level: 'low' };

  const countSlot = (slot) => {
    const segments = serviceData[slot] || [];
    return {
      segments: segments.filter(s => s.type !== 'break').length,
      songs: segments.reduce((sum, seg) => sum + (seg.songs?.filter(s => s.title).length || 0), 0),
      notes: serviceData.pre_service_notes?.[slot] ? 1 : 0,
    };
  };

  const count930 = countSlot("9:30am");
  const count1130 = countSlot("11:30am");

  // Estimate page units (1 unit ≈ 1 line of content)
  const units930 = count930.segments * 4 + count930.songs * 1.2 + count930.notes * 2;
  const units1130 = count1130.segments * 4 + count1130.songs * 1.2 + count1130.notes * 2;

  // Each column can fit ~50 units comfortably
  const maxUnitsPerColumn = 50;

  if (units930 > maxUnitsPerColumn || units1130 > maxUnitsPerColumn) {
    return { hasOverflow: true, level: 'high', label: 'Sobrecarga Detectada', color: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (units930 > maxUnitsPerColumn * 0.85 || units1130 > maxUnitsPerColumn * 0.85) {
    return { hasOverflow: true, level: 'medium', label: 'Riesgo Moderado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  }

  return { hasOverflow: false, level: 'low', label: 'Se Ajusta Bien', color: 'bg-green-100 text-green-800 border-green-300' };
}

/**
 * Estimates whether the announcements page will overflow.
 * @param {Array} fixedAnnouncements
 * @param {Array} dynamicAnnouncements
 * @param {Array} selectedAnnouncements — IDs of selected announcements
 * @returns {{ hasOverflow: boolean, level: string, label?: string, color?: string }}
 */
export function calculateAnnouncementOverflow(fixedAnnouncements, dynamicAnnouncements, selectedAnnouncements) {
  const selected = [...fixedAnnouncements, ...dynamicAnnouncements]
    .filter(ann => selectedAnnouncements.includes(ann.id));

  if (selected.length === 0) {
    return { hasOverflow: false, level: 'low', label: 'Sin Anuncios', color: 'bg-gray-100 text-gray-800 border-gray-300' };
  }

  const fixedSelected = selected.filter(a => !a.isEvent && a.category === 'General');
  const dynamicSelected = selected.filter(a => a.isEvent || a.category !== 'General');

  const calculateUnits = (ann) => {
    const content = ann.isEvent ? (ann.announcement_blurb || ann.description || '') : (ann.content || '');
    const instructions = ann.instructions || '';

    const contentText = content.replace(/<[^>]*>/g, '');
    const instructionsText = instructions.replace(/<[^>]*>/g, '');

    // 2-column layout: ~40 chars per line
    const contentLines = Math.ceil(contentText.length / 40);
    const instructionLines = Math.ceil(instructionsText.length / 35);

    let units = 2; // Title
    units += contentLines;
    units += instructionLines * 1.5;
    units += (ann.has_video || ann.announcement_has_video) ? 0.5 : 0;
    units += 1; // Spacing

    return units;
  };

  const fixedUnits = fixedSelected.reduce((sum, ann) => sum + calculateUnits(ann), 0);
  const dynamicUnits = dynamicSelected.reduce((sum, ann) => sum + calculateUnits(ann), 0);

  // Each column can fit ~55 units
  const maxUnitsPerColumn = 55;

  if (fixedUnits > maxUnitsPerColumn || dynamicUnits > maxUnitsPerColumn) {
    return { hasOverflow: true, level: 'high', label: 'Sobrecarga Detectada', color: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (fixedUnits > maxUnitsPerColumn * 0.85 || dynamicUnits > maxUnitsPerColumn * 0.85) {
    return { hasOverflow: true, level: 'medium', label: 'Riesgo Moderado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  }

  return { hasOverflow: false, level: 'low', label: 'Se Ajusta Bien', color: 'bg-green-100 text-green-800 border-green-300' };
}