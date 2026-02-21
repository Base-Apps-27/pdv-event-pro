/**
 * useOverflowDetection — Extracted from WeeklyServiceManager (Phase 3A).
 * Pure helper functions for estimating print-page overflow risk.
 * Not a hook per se, but grouped for clarity. No React dependencies.
 */

/**
 * Estimates whether the multi-column service program will overflow a single printed page.
 * Dynamic: discovers slot keys from serviceData instead of assuming "9:30am"/"11:30am".
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

  // Dynamic slot discovery
  const slotKeys = Object.keys(serviceData)
    .filter(k => /^\d+:\d+[ap]m$/i.test(k) && Array.isArray(serviceData[k]));

  // Estimate page units per slot (1 unit ≈ 1 line of content)
  const maxUnitsPerColumn = 50;
  let maxUnits = 0;

  for (const slot of slotKeys) {
    const c = countSlot(slot);
    const units = c.segments * 4 + c.songs * 1.2 + c.notes * 2;
    if (units > maxUnits) maxUnits = units;
  }

  if (maxUnits > maxUnitsPerColumn) {
    return { hasOverflow: true, level: 'high', label: 'Sobrecarga Detectada', color: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (maxUnits > maxUnitsPerColumn * 0.85) {
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