/**
 * weeklyBlueprint.js
 * Phase 3A extraction: Hardcoded blueprint constant for weekly Sunday services.
 * Used as fallback when no database blueprint (status='blueprint') exists.
 * Pure data — no logic, no side effects.
 */

export const WEEKLY_BLUEPRINT = {
  "9:30am": [
    { 
      type: "worship", 
      title: "Equipo de A&A", 
      duration: 35, 
      fields: ["leader", "songs", "ministry_leader"],
      actions: [
        { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
      ]
    },
    { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"], actions: [] },
    { 
      type: "offering", 
      title: "Ofrendas", 
      duration: 5, 
      fields: ["presenter", "verse"],
      actions: [
        { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
      ]
    },
    { 
      type: "message", 
      title: "Mensaje", 
      duration: 45, 
      fields: ["preacher", "title", "verse"],
      actions: [
        { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
        { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
      ]
    }
  ],
  "11:30am": [
    { 
      type: "worship", 
      title: "Equipo de A&A", 
      duration: 35, 
      fields: ["leader", "songs", "ministry_leader", "translator"],
      actions: [
        { label: "Video de introducción en FB", timing: "before_start", offset_min: 0, department: "Projection" }
      ],
      requires_translation: true,
      default_translator_source: "manual"
    },
    { 
      type: "welcome", 
      title: "Bienvenida y Anuncios", 
      duration: 5, 
      fields: ["presenter", "translator"], 
      actions: [],
      requires_translation: true,
      default_translator_source: "worship_segment_translator"
    },
    { 
      type: "offering", 
      title: "Ofrendas", 
      duration: 5, 
      fields: ["presenter", "verse", "translator"],
      actions: [
        { label: "Enviar texto: 844-555-5555", timing: "after_start", offset_min: 0, department: "Admin" }
      ],
      requires_translation: true,
      default_translator_source: "worship_segment_translator"
    },
    { 
      type: "message", 
      title: "Mensaje", 
      duration: 45, 
      fields: ["preacher", "title", "verse", "translator"],
      actions: [
        { label: "Pianista sube", timing: "before_end", offset_min: 15, department: "Alabanza" },
        { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }
      ],
      requires_translation: true,
      default_translator_source: "manual"
    }
  ]
};