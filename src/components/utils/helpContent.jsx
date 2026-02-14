/**
 * helpContent.js
 * Centralized bilingual help content dictionary.
 * Each key maps to { title: { es, en }, body: { es, en } }.
 *
 * Guidelines:
 *   - No emdashes anywhere. Use commas, periods, or "or" instead.
 *   - Keep tooltip bodies under ~120 words. Use modal mode for longer content.
 *   - Group keys by surface for easy auditing.
 */

export const HELP_CONTENT = {

  // ─── Stream Block Types (StreamBlockForm) ───────────────────────────
  "stream.blockTypes": {
    title: {
      es: "Tipos de Stream Block",
      en: "Stream Block Types",
    },
    body: {
      es:
`Hay 4 tipos de bloques para construir tu timeline de livestream:

LINK: Transmite el segmento de sala tal como es. El stream sigue lo que pasa en el programa principal. Es el tipo más común.

INSERT: Agrega contenido exclusivo del stream (entrevista, pre-show, bumper) que no existe en el programa de sala. No reemplaza nada.

REPLACE: Sustituye un segmento de sala por contenido diferente en el stream. Lo que el público presencial ve es distinto a lo que ve el público en línea.

OFFLINE: Marca un momento donde el stream se pausa o muestra una pantalla de espera (cuenta regresiva, loop de video, etc.).`,
      en:
`There are 4 block types for building your livestream timeline:

LINK: Broadcasts the room segment as is. The stream follows the main program. This is the most common type.

INSERT: Adds stream-only content (interview, pre-show, bumper) that does not exist in the room program. It does not replace anything.

REPLACE: Swaps a room segment for different content on the stream. The in-person audience sees something different from the online audience.

OFFLINE: Marks a moment where the stream pauses or shows a holding screen (countdown, video loop, etc.).`,
    },
  },

  "stream.blockType.link": {
    title: { es: "Link", en: "Link" },
    body: {
      es: "Transmite el segmento de sala tal como es. El stream sigue el programa principal. Hereda la duración del segmento anclado si no defines una.",
      en: "Broadcasts the room segment as is. The stream follows the main program. Inherits the anchored segment's duration if you don't set one.",
    },
  },

  "stream.blockType.insert": {
    title: { es: "Insert", en: "Insert" },
    body: {
      es: "Agrega contenido exclusivo del stream que no existe en el programa de sala. Ejemplos: entrevista pre-show, bumper de marca, anuncio solo para online.",
      en: "Adds stream-only content that does not exist in the room program. Examples: pre-show interview, brand bumper, online-only announcement.",
    },
  },

  "stream.blockType.replace": {
    title: { es: "Replace", en: "Replace" },
    body: {
      es: "Sustituye un segmento de sala por contenido diferente en el stream. La audiencia presencial ve algo distinto a la audiencia en línea.",
      en: "Swaps a room segment for different content on the stream. The in-person audience sees something different from the online audience.",
    },
  },

  "stream.blockType.offline": {
    title: { es: "Offline", en: "Offline" },
    body: {
      es: "El stream se pausa o muestra una pantalla de espera. Usa esto durante recesos, transiciones, o momentos que no se transmiten.",
      en: "The stream pauses or shows a holding screen. Use this during breaks, transitions, or moments not being broadcast.",
    },
  },

  // ─── Stream Block Anchoring (StreamBlockForm) ──────────────────────
  "stream.anchoring": {
    title: {
      es: "Anclaje y Timing",
      en: "Anchoring and Timing",
    },
    body: {
      es:
`Cada stream block se posiciona relativo a un segmento del programa principal (su "ancla").

Al inicio: El bloque comienza cuando el segmento empieza.
Antes de iniciar: El bloque comienza antes que el segmento (usa el offset para definir cuántos minutos antes).
Al final: El bloque comienza cuando el segmento termina.
Hora fija: El bloque comienza a una hora específica sin depender de ningún segmento.

El Offset (en minutos) permite ajustar con precisión. Negativo = antes del punto de anclaje. Positivo = después.`,
      en:
`Each stream block is positioned relative to a segment in the main program (its "anchor").

At Start: Block begins when the segment starts.
Before Start: Block begins before the segment (use offset to set how many minutes before).
At End: Block begins when the segment ends.
Fixed Time: Block begins at a specific time, independent of any segment.

The Offset (in minutes) allows fine-tuning. Negative = before the anchor point. Positive = after.`,
    },
  },

  "stream.actions": {
    title: {
      es: "Acciones del Stream (Cues)",
      en: "Stream Actions (Cues)",
    },
    body: {
      es: "Son instrucciones técnicas con tiempo para el equipo de livestream. Ejemplo: 'Cámara 2' a los 2 minutos de iniciar, o 'Lower third ON' al inicio. Cada cue tiene un momento relativo al bloque.",
      en: "These are timed technical instructions for the livestream team. Example: 'Camera 2' at 2 minutes after start, or 'Lower third ON' at start. Each cue has a timing relative to the block.",
    },
  },

  "stream.overview": {
    title: {
      es: "Timeline de Livestream",
      en: "Livestream Timeline",
    },
    body: {
      es: "Los Stream Blocks definen qué se transmite en línea y cuándo. Puedes seguir el programa de sala (Link), agregar contenido exclusivo (Insert), reemplazar segmentos (Replace) o pausar el stream (Offline).",
      en: "Stream Blocks define what gets broadcast online and when. You can follow the room program (Link), add exclusive content (Insert), replace segments (Replace), or pause the stream (Offline).",
    },
  },

  // ─── Segment Form (SegmentFormTwoColumn + SegmentForm) ─────────────
  "segment.types": {
    title: {
      es: "Tipos de Segmento",
      en: "Segment Types",
    },
    body: {
      es:
`El tipo define el propósito del segmento y habilita campos específicos:

Alabanza: Bloque de adoración con canciones.
Plenaria: Predicación o mensaje con versículos y slides.
Panel: Mesa redonda con moderador y panelistas.
Artes: Danza, drama, video especial.
Receso/Almuerzo: Pausa con o sin persona dando instrucciones.
TechOnly: Nota interna que no aparece en el programa público.
Anuncio: Anuncio con contenido de una serie.
Video: Reproducción de un video.

Los demás (Bienvenida, Ofrenda, MC, etc.) son segmentos generales.`,
      en:
`The type defines the segment's purpose and enables specific fields:

Alabanza: Worship block with songs.
Plenaria: Preaching or message with scriptures and slides.
Panel: Round table with moderator and panelists.
Artes: Dance, drama, special video.
Receso/Almuerzo: Break with or without a host giving instructions.
TechOnly: Internal note that does not appear in the public program.
Anuncio: Announcement with content from a series.
Video: Video playback.

Others (Bienvenida, Ofrenda, MC, etc.) are general-purpose segments.`,
    },
  },

  "segment.timing": {
    title: {
      es: "Horarios del Segmento",
      en: "Segment Timing",
    },
    body: {
      es: "Define la hora de inicio y la duración. El sistema calcula la hora de fin automáticamente. Los segmentos no deben solaparse dentro de la misma sesión.",
      en: "Set the start time and duration. The system calculates the end time automatically. Segments must not overlap within the same session.",
    },
  },

  "segment.stageCall": {
    title: {
      es: "Llegada de Equipos",
      en: "Stage Call / Team Arrival",
    },
    body: {
      es: "Cuántos minutos antes del inicio deben llegar los equipos involucrados (sonido, proyección, etc.). Se usa en los reportes y vista del programa.",
      en: "How many minutes before start the involved teams should arrive (sound, projection, etc.). Used in reports and program views.",
    },
  },

  "segment.visibility": {
    title: {
      es: "Visibilidad en Reportes",
      en: "Report Visibility",
    },
    body: {
      es: "Controla en qué reportes aparece este segmento. Por ejemplo, un segmento TechOnly puede ocultarse del programa general pero mostrarse en el reporte de sonido.",
      en: "Controls which reports this segment appears in. For example, a TechOnly segment can be hidden from the general program but shown in the sound report.",
    },
  },

  "segment.colorCode": {
    title: {
      es: "Código de Color",
      en: "Color Code",
    },
    body: {
      es: "El color visual del segmento en el timeline y reportes. Se asigna automáticamente según el tipo, pero puedes cambiarlo manualmente.",
      en: "The segment's visual color in the timeline and reports. Assigned automatically based on type, but you can change it manually.",
    },
  },

  "segment.teamNotes": {
    title: {
      es: "Notas para Equipos",
      en: "Team Notes",
    },
    body: {
      es: "Instrucciones específicas que aparecen en el reporte de cada equipo. Cada equipo solo ve las notas que le corresponden.",
      en: "Specific instructions that appear in each team's report. Each team only sees the notes assigned to them.",
    },
  },

  // ─── Segment Actions (SegmentActionsEditor) ────────────────────────
  "segment.actions": {
    title: {
      es: "Acciones / Tareas de Preparación",
      en: "Actions / Preparation Tasks",
    },
    body: {
      es:
`Son tareas operativas con tiempo asociado para diferentes equipos.

Cada acción tiene:
- Etiqueta: qué hacer (ej. "A&A sube al escenario")
- Equipo: quién es responsable
- Timing: cuándo ocurre relativo al segmento
- Offset: cuántos minutos antes o después

Ejemplos:
"5 min antes de iniciar, Sonido sube volumen de fondo"
"Al iniciar, MC sale del escenario"`,
      en:
`These are timed operational tasks for different teams.

Each action has:
- Label: what to do (e.g. "Worship team to stage")
- Team: who is responsible
- Timing: when it happens relative to the segment
- Offset: how many minutes before or after

Examples:
"5 min before start, Sound raises background volume"
"At start, MC exits stage"`,
    },
  },

  "segment.actionTiming": {
    title: {
      es: "Timing de la Acción",
      en: "Action Timing",
    },
    body: {
      es: "Antes de iniciar: X minutos antes que empiece el segmento.\nDespués de iniciar: X minutos después que empiece.\nAntes de terminar: X minutos antes que termine.\nHora exacta: a una hora fija sin depender del segmento.",
      en: "Before start: X minutes before the segment begins.\nAfter start: X minutes after it begins.\nBefore end: X minutes before it ends.\nFixed time: at a specific time, independent of the segment.",
    },
  },

  // ─── Translation ───────────────────────────────────────────────────
  "segment.translation": {
    title: {
      es: "Traducción",
      en: "Translation",
    },
    body: {
      es: "Marca si este segmento necesita traducción simultánea. Puedes elegir si el traductor está en tarima (En Persona) o en cabina con audífonos (Cabina Remota).",
      en: "Mark if this segment needs simultaneous translation. Choose whether the translator is on stage (In Person) or in a booth with headsets (Remote Booth).",
    },
  },

  // ─── Session Level ─────────────────────────────────────────────────
  "session.overview": {
    title: {
      es: "Sesiones del Evento",
      en: "Event Sessions",
    },
    body: {
      es: "Una sesión es un bloque de tiempo dentro de un evento (ej. Viernes PM, Sábado AM). Cada sesión contiene segmentos que forman el programa. Puedes asignar equipos por sesión y habilitar livestream.",
      en: "A session is a time block within an event (e.g. Friday PM, Saturday AM). Each session contains segments that form the program. You can assign teams per session and enable livestream.",
    },
  },

  "session.livestreamToggle": {
    title: {
      es: "Habilitar Livestream",
      en: "Enable Livestream",
    },
    body: {
      es: "Cuando activas livestream en una sesión, puedes crear Stream Blocks: un timeline paralelo que define qué se transmite en línea. Los usuarios con rol de Admin Livestream solo pueden ver sesiones con esta opción habilitada.",
      en: "When you enable livestream on a session, you can create Stream Blocks: a parallel timeline defining what gets broadcast online. Users with the Livestream Admin role can only see sessions with this option enabled.",
    },
  },
};