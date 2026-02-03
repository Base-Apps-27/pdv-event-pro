/**
 * SEGMENT TYPE DISPLAY MAPPING
 * ============================
 * 
 * This file defines HOW each segment type is displayed in list views.
 * It answers: "For Title/Responsible column, what fields should appear?"
 * 
 * FIELD DEFINITIONS:
 * - title: Always segment.title (all types)
 * - responsible: Varies by type (see mapping below)
 * - responsibleLabel: Prefix for display (e.g., "Líder:", "Predicador:")
 * 
 * CRITICAL RULES:
 * 1. Panel type NEVER uses presenter - only panel_panelists and panel_moderators
 * 2. Breakout type shows room count, not presenter
 * 3. Break types (Receso, Almuerzo) show presenter as optional "Encargado"
 * 4. Worship (Alabanza) shows presenter as "Líder"
 * 5. Plenaria shows presenter as "Predicador"
 * 
 * DECISION LOG: Panel segments must display panel_panelists, not presenter (2025)
 */

/**
 * Get the display configuration for a segment type.
 * 
 * @param {string} segmentType - The segment_type value
 * @param {string} language - 'es' or 'en'
 * @returns {Object} Display configuration
 */
export function getSegmentDisplayConfig(segmentType, language = 'es') {
  const configs = {
    // PANEL: Show panelists, NEVER presenter
    Panel: {
      showPresenter: false,
      responsibleField: 'panel_panelists',
      responsibleFallback: 'panel_moderators',
      responsibleLabel: { es: '', en: '' }, // No prefix - panelists are self-explanatory
      showSecondaryBadge: false,
    },
    
    // PLENARIA: Show presenter as "Predicador"
    Plenaria: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Predicador: ', en: 'Preacher: ' },
      secondaryField: 'message_title',
      secondaryFieldStyle: 'italic text-blue-600',
    },
    
    // ALABANZA: Show presenter as "Líder"
    Alabanza: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Líder: ', en: 'Leader: ' },
    },
    
    // BREAK TYPES: Presenter is optional "Encargado"
    Break: {
      showPresenter: true,
      presenterOptional: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Encargado: ', en: 'Host: ' },
    },
    Receso: {
      showPresenter: true,
      presenterOptional: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Encargado: ', en: 'Host: ' },
    },
    Almuerzo: {
      showPresenter: true,
      presenterOptional: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Encargado: ', en: 'Host: ' },
    },
    
    // BREAKOUT: No presenter, show room count in badges
    Breakout: {
      showPresenter: false,
      showRoomCount: true,
    },
    
    // TECHONLY: No presenter needed
    TechOnly: {
      showPresenter: false,
    },
    
    // VIDEO: Show presenter generically
    Video: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    
    // ARTES: Show presenter as "Grupo/Director"
    Artes: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: 'Grupo: ', en: 'Group: ' },
    },
    
    // MC-LED SEGMENTS: Generic presenter
    Bienvenida: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Ofrenda: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Anuncio: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Dinámica: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Oración: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Especial: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Cierre: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    MC: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
    Ministración: {
      showPresenter: true,
      responsibleField: 'presenter',
      responsibleLabel: { es: '', en: '' },
    },
  };
  
  // Return config or default
  return configs[segmentType] || {
    showPresenter: true,
    responsibleField: 'presenter',
    responsibleLabel: { es: '', en: '' },
  };
}

/**
 * Get the "responsible" display string for a segment.
 * This is the value shown under the title in list views.
 * 
 * @param {Object} segment - The segment object
 * @param {string} language - 'es' or 'en'
 * @returns {Object} { label: string, value: string, style?: string } or null if none
 */
export function getSegmentResponsibleDisplay(segment, language = 'es') {
  if (!segment || !segment.segment_type) return null;
  
  const config = getSegmentDisplayConfig(segment.segment_type, language);
  
  // Panel type: special handling
  if (segment.segment_type === 'Panel') {
    const value = segment.panel_panelists || segment.panel_moderators;
    if (value) {
      return {
        label: config.responsibleLabel?.[language] || '',
        value: value,
      };
    }
    return null;
  }
  
  // Breakout type: no responsible, just room count
  if (segment.segment_type === 'Breakout') {
    return null; // Room count shown via badge instead
  }
  
  // TechOnly: no responsible
  if (segment.segment_type === 'TechOnly') {
    return null;
  }
  
  // Standard presenter-based types
  if (config.showPresenter) {
    const value = segment[config.responsibleField];
    if (value) {
      return {
        label: config.responsibleLabel?.[language] || '',
        value: value,
        style: config.responsibleFieldStyle,
      };
    }
    // Check fallback
    if (config.responsibleFallback) {
      const fallbackValue = segment[config.responsibleFallback];
      if (fallbackValue) {
        return {
          label: config.responsibleLabel?.[language] || '',
          value: fallbackValue,
        };
      }
    }
  }
  
  return null;
}

/**
 * Get secondary display info for a segment (e.g., message_title for Plenaria).
 * 
 * @param {Object} segment
 * @param {string} language
 * @returns {Object|null} { value: string, style: string } or null
 */
export function getSegmentSecondaryDisplay(segment, language = 'es') {
  if (!segment || !segment.segment_type) return null;
  
  const config = getSegmentDisplayConfig(segment.segment_type, language);
  
  if (config.secondaryField && segment[config.secondaryField]) {
    return {
      value: segment[config.secondaryField],
      style: config.secondaryFieldStyle || '',
    };
  }
  
  return null;
}

/**
 * Check if presenter field should be editable for this segment type.
 * 
 * @param {string} segmentType
 * @returns {boolean}
 */
export function isPresenterEditable(segmentType) {
  const config = getSegmentDisplayConfig(segmentType);
  return config.showPresenter === true;
}

/**
 * Check if presenter field is optional for this segment type.
 * 
 * @param {string} segmentType
 * @returns {boolean}
 */
export function isPresenterOptional(segmentType) {
  const config = getSegmentDisplayConfig(segmentType);
  return config.presenterOptional === true;
}