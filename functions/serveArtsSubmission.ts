import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * serveArtsSubmission.js
 * Public HTML form for Arts Directors to fill in technical/creative details
 * for existing "Artes" segments within a given Event.
 * 
 * Architecture mirrors serveSpeakerSubmission: standalone HTML, no React/auth needed.
 * Data is saved per-segment via submitArtsSegment backend function.
 * 
 * Query params: ?event_id=xxx
 */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        const eventIdParam = url.searchParams.get('event_id');

        let targetEvent = null;
        let eventError = null;
        let artsSegments = [];
        let sessionsMap = {};

        try {
            if (eventIdParam) {
                targetEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
            } else {
                // Find next upcoming confirmed event
                const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
                const today = new Date().toISOString().split('T')[0];
                const upcoming = events.filter(e => e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
                if (upcoming.length > 0) {
                    targetEvent = upcoming[0];
                } else {
                    const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
                    if (progress.length > 0) targetEvent = progress[0];
                }
            }

            if (targetEvent) {
                const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
                sessions.forEach(s => { sessionsMap[s.id] = s; });

                if (sessions.length > 0) {
                    const segPromises = sessions.map(sess =>
                        base44.asServiceRole.entities.Segment.filter({
                            session_id: sess.id,
                            segment_type: 'Artes'
                        })
                    );
                    const results = await Promise.all(segPromises);
                    artsSegments = results.flat();

                    // Sort by session date then start_time
                    artsSegments.sort((a, b) => {
                        const sa = sessionsMap[a.session_id];
                        const sb = sessionsMap[b.session_id];
                        const da = (sa?.date || '') + (a.start_time || '');
                        const db = (sb?.date || '') + (b.start_time || '');
                        return da.localeCompare(db);
                    });
                }
            } else {
                eventError = "No se encontró un evento activo. / No active event found.";
            }
        } catch (err) {
            console.error("Data fetch error:", err);
            eventError = "Error cargando datos del evento.";
        }

        const eventName = targetEvent ? targetEvent.name : "Evento";
        const eventLocation = targetEvent?.location || "";
        const eventDate = targetEvent?.start_date
            ? new Date(targetEvent.start_date + "T12:00:00").toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
            : "";

        // Determine if this is a "Única" event (strict media rules)
        const isUnicaEvent = targetEvent?.name ? /\bÚnica\b/i.test(targetEvent.name) || /\bunica\b/i.test(targetEvent.name) : false;

        // Serialize segments data for the client-side JS
        const segmentsJson = JSON.stringify(artsSegments.map(seg => {
            const sess = sessionsMap[seg.session_id];
            return {
                id: seg.id,
                title: seg.title || 'Sin título',
                session_name: sess?.name || '',
                session_date: sess?.date || '',
                start_time: seg.start_time || '',
                art_types: seg.art_types || [],
                // Dance fields
                dance_has_song: seg.dance_has_song || false,
                dance_handheld_mics: seg.dance_handheld_mics || 0,
                dance_headset_mics: seg.dance_headset_mics || 0,
                dance_start_cue: seg.dance_start_cue || '',
                dance_end_cue: seg.dance_end_cue || '',
                dance_song_title: seg.dance_song_title || '',
                dance_song_source: seg.dance_song_source || '',
                dance_song_owner: seg.dance_song_owner || '',
                dance_song_2_title: seg.dance_song_2_title || '',
                dance_song_2_url: seg.dance_song_2_url || '',
                dance_song_2_owner: seg.dance_song_2_owner || '',
                dance_song_3_title: seg.dance_song_3_title || '',
                dance_song_3_url: seg.dance_song_3_url || '',
                dance_song_3_owner: seg.dance_song_3_owner || '',
                // Drama fields
                drama_has_song: seg.drama_has_song || false,
                drama_handheld_mics: seg.drama_handheld_mics || 0,
                drama_headset_mics: seg.drama_headset_mics || 0,
                drama_start_cue: seg.drama_start_cue || '',
                drama_end_cue: seg.drama_end_cue || '',
                drama_song_title: seg.drama_song_title || '',
                drama_song_source: seg.drama_song_source || '',
                drama_song_owner: seg.drama_song_owner || '',
                drama_song_2_title: seg.drama_song_2_title || '',
                drama_song_2_url: seg.drama_song_2_url || '',
                drama_song_2_owner: seg.drama_song_2_owner || '',
                drama_song_3_title: seg.drama_song_3_title || '',
                drama_song_3_url: seg.drama_song_3_url || '',
                drama_song_3_owner: seg.drama_song_3_owner || '',
                // Video fields
                has_video: seg.has_video || false,
                video_name: seg.video_name || '',
                video_url: seg.video_url || '',
                video_owner: seg.video_owner || '',
                video_length_sec: seg.video_length_sec || 0,
                video_location: seg.video_location || '',
                // Other
                art_other_description: seg.art_other_description || '',
                arts_run_of_show_url: seg.arts_run_of_show_url || '',
                presenter: seg.presenter || '',
                description_details: seg.description_details || '',
            };
        }));

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formulario de Artes | ${escapeHtml(eventName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-charcoal: #1A1A1A;
      --brand-teal: #1F8A70;
      --brand-green: #8DC63F;
      --brand-yellow: #D7DF23;
      --brand-pink: #E91E8C;
      --text-primary: #111827;
      --text-secondary: #6B7280;
      --text-tertiary: #9CA3AF;
      --border-light: #E5E7EB;
      --bg-light: #F9FAFB;
      --bg-white: #FFFFFF;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(to bottom right, #f0f9ff 0%, #e0f2fe 50%, #fce7f3 100%);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .page-container { 
      width: 100%; 
      max-width: 800px; 
      animation: fadeIn 0.5s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Header Card */
    .header-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      overflow: hidden;
      margin-bottom: 32px;
      box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
      position: relative;
    }
    .gradient-bar { 
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px; 
      background: linear-gradient(90deg, #E91E8C 0%, #1F8A70 50%, #8DC63F 100%); 
      opacity: 0.9;
    }
    .header-content { 
      padding: 48px 40px 40px 40px; 
      text-align: center; 
    }
    .header-content .org { 
      font-size: 0.7rem; 
      font-weight: 900; 
      color: var(--brand-teal); 
      text-transform: uppercase; 
      letter-spacing: 0.15em; 
      margin-bottom: 8px;
      opacity: 0.7;
    }
    .header-content h1 { 
      font-family: 'Bebas Neue', sans-serif; 
      font-size: 3.5rem; 
      background: linear-gradient(135deg, var(--brand-pink), var(--brand-teal));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 0.03em; 
      line-height: 0.9; 
      margin-bottom: 16px; 
    }
    .header-content .event-name { 
      font-size: 1.15rem; 
      font-weight: 700; 
      color: var(--brand-charcoal); 
      text-transform: uppercase; 
      letter-spacing: 0.08em; 
      margin-bottom: 4px;
    }
    .event-meta { 
      font-size: 0.85rem; 
      color: var(--text-tertiary); 
      display: flex; 
      justify-content: center; 
      flex-wrap: wrap; 
      gap: 20px; 
      margin-top: 20px; 
      font-weight: 500; 
    }
    .meta-item { 
      display: flex; 
      align-items: center; 
      gap: 6px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 20px;
    }
    .meta-icon { width: 16px; height: 16px; color: var(--brand-teal); opacity: 0.8; }

    /* Link hint — subtle inline helper text shown beneath URL fields */
    .link-hint {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      margin-top: 4px;
      line-height: 1.4;
    }
    .link-hint-strict {
      color: #B45309;
    }

    /* Gate */
    .gate-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 32px;
      margin-bottom: 28px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
    }
    .gate-card h2 { 
      font-family: 'Bebas Neue', sans-serif; 
      font-size: 1.5rem; 
      background: linear-gradient(90deg, var(--brand-pink), var(--brand-teal));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px; 
      letter-spacing: 0.08em;
    }
    .gate-card p {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .gate-card input {
      width: 100%; 
      padding: 14px 16px; 
      border: 2px solid rgba(229, 231, 235, 0.5); 
      border-radius: 10px;
      font-family: inherit; 
      font-size: 1rem; 
      margin-bottom: 16px; 
      background: rgba(255, 255, 255, 0.8);
      transition: all 0.2s ease;
    }
    .gate-card input:focus { 
      outline: none; 
      border-color: var(--brand-teal); 
      background: white;
      box-shadow: 0 0 0 4px rgba(31, 138, 112, 0.1);
      transform: translateY(-1px);
    }

    /* Accordion */
    .accordion-item {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      margin-bottom: 20px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .accordion-item:hover {
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    .accordion-header {
      padding: 20px 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      transition: all 0.2s ease;
      position: relative;
    }
    .accordion-header::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, var(--brand-pink), var(--brand-teal));
      opacity: 0;
      transition: opacity 0.2s;
    }
    .accordion-header:hover::before { opacity: 1; }
    .accordion-header:hover { background: rgba(255, 255, 255, 0.5); }
    .accordion-header .left { flex: 1; padding-right: 16px; }
    .accordion-header .seg-title { 
      font-weight: 700; 
      font-size: 1.1rem; 
      color: var(--brand-charcoal);
      letter-spacing: 0.01em;
    }
    .accordion-header .seg-meta { 
      font-size: 0.85rem; 
      color: var(--text-tertiary); 
      margin-top: 4px;
      font-weight: 500;
    }
    .accordion-header .art-types { 
      display: flex; 
      gap: 8px; 
      margin-top: 8px; 
      flex-wrap: wrap; 
    }
    .art-type-tag { 
      font-size: 0.7rem; 
      padding: 4px 10px; 
      border-radius: 12px; 
      background: linear-gradient(135deg, #fce7f3, #fbcfe8); 
      color: #9D174D; 
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .status-badge { 
      font-size: 0.75rem; 
      font-weight: 800; 
      padding: 6px 14px; 
      border-radius: 20px; 
      white-space: nowrap;
      letter-spacing: 0.03em;
    }
    .status-incomplete { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991B1B; }
    .status-minimum { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400E; }
    .status-complete { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #065F46; }
    .chevron { 
      width: 24px; 
      height: 24px; 
      color: var(--brand-teal); 
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
      margin-left: 12px;
      flex-shrink: 0;
    }
    .chevron.open { transform: rotate(180deg); }

    .accordion-body { 
      display: none; 
      padding: 0 24px 24px; 
      border-top: 1px solid rgba(229, 231, 235, 0.3);
      animation: slideDown 0.3s ease-out;
    }
    .accordion-body.open { display: block; }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Form sections inside accordion */
    .form-section { margin-top: 24px; }
    .form-section-title { 
      font-family: 'Bebas Neue', sans-serif; 
      font-size: 1.4rem; 
      background: linear-gradient(90deg, var(--brand-pink), var(--brand-teal));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px; 
      letter-spacing: 0.06em; 
    }
    .form-group { margin-bottom: 20px; }
    .form-group label { 
      display: block; 
      font-size: 0.75rem; 
      font-weight: 800; 
      color: var(--text-secondary); 
      text-transform: uppercase; 
      letter-spacing: 0.08em; 
      margin-bottom: 8px; 
    }
    .form-group input, .form-group textarea {
      width: 100%; 
      padding: 12px 14px; 
      border: 2px solid rgba(229, 231, 235, 0.5); 
      border-radius: 10px;
      font-family: inherit; 
      font-size: 0.95rem; 
      background: rgba(255, 255, 255, 0.7);
      color: var(--text-primary);
      transition: all 0.2s ease;
    }
    .form-group input:focus, .form-group textarea:focus { 
      outline: none; 
      border-color: var(--brand-teal); 
      background: white;
      box-shadow: 0 0 0 4px rgba(31, 138, 112, 0.1);
      transform: translateY(-1px);
    }
    .form-group textarea { min-height: 90px; resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }

    /* Checkboxes */
    .check-group { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .check-label { 
      display: flex; 
      align-items: center; 
      gap: 8px; 
      font-size: 0.9rem; 
      cursor: pointer; 
      padding: 10px 16px; 
      border: 2px solid rgba(229, 231, 235, 0.5); 
      border-radius: 12px; 
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.5);
    }
    .check-label:hover { 
      border-color: var(--brand-pink); 
      background: rgba(252, 231, 243, 0.3);
      transform: translateY(-1px);
    }
    .check-label.checked { 
      background: linear-gradient(135deg, #fce7f3, #fbcfe8); 
      border-color: var(--brand-pink); 
      color: #9D174D; 
      font-weight: 700;
      box-shadow: 0 4px 8px rgba(233, 30, 140, 0.15);
    }
    .check-label input[type="checkbox"] { 
      width: 18px; 
      height: 18px; 
      accent-color: var(--brand-pink); 
      cursor: pointer;
    }

    /* Type-specific section */
    .type-section { 
      background: linear-gradient(135deg, rgba(252, 231, 243, 0.3), rgba(251, 207, 232, 0.2)); 
      border: 1px solid rgba(233, 30, 140, 0.2);
      border-radius: 12px; 
      padding: 24px; 
      margin-top: 20px; 
    }
    .type-section-title { 
      font-family: 'Inter', sans-serif;
      font-size: 1rem; 
      font-weight: 800; 
      color: var(--brand-pink); 
      margin-bottom: 20px; 
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Song slot */
    .song-slot { 
      border-top: 1px solid rgba(251, 207, 232, 0.5); 
      padding-top: 16px; 
      margin-top: 16px; 
    }
    .song-slot:first-child { border-top: none; padding-top: 0; margin-top: 0; }

    /* Save button */
    .save-btn {
      width: 100%; 
      padding: 18px; 
      margin-top: 24px;
      background: linear-gradient(135deg, #E91E8C 0%, #1F8A70 50%, #8DC63F 100%);
      background-size: 200% 200%;
      color: white; 
      font-family: inherit;
      font-weight: 800; 
      font-size: 1rem; 
      text-transform: uppercase; 
      letter-spacing: 0.08em;
      border: none; 
      border-radius: 12px; 
      cursor: pointer; 
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(233, 30, 140, 0.3);
    }
    .save-btn:hover { 
      background-position: 100% 50%;
      box-shadow: 0 8px 20px rgba(233, 30, 140, 0.4); 
      transform: translateY(-2px); 
    }
    .save-btn:active {
      transform: translateY(0);
    }
    .save-btn:disabled { 
      opacity: 0.6; 
      cursor: not-allowed; 
      transform: none; 
      box-shadow: none;
    }
    .save-status { 
      text-align: center; 
      margin-top: 12px; 
      font-size: 0.95rem; 
      font-weight: 600; 
      min-height: 24px; 
    }
    .save-success { color: #065F46; }
    .save-error { color: #991B1B; }

    .primary-btn {
      width: 100%;
      padding: 18px; 
      background: linear-gradient(135deg, #1F8A70 0%, #8DC63F 100%);
      background-size: 200% 200%;
      color: white; 
      font-family: inherit;
      font-weight: 800; 
      font-size: 1rem; 
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: none; 
      border-radius: 12px; 
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(31, 138, 112, 0.3);
    }
    .primary-btn:hover {
      background-position: 100% 50%;
      box-shadow: 0 8px 20px rgba(31, 138, 112, 0.4);
      transform: translateY(-2px);
    }
    .primary-btn:active {
      transform: translateY(0);
    }
    .primary-btn:disabled { 
      opacity: 0.6; 
      cursor: not-allowed; 
      transform: none;
      box-shadow: none;
    }

    .empty-state { 
      text-align: center; 
      padding: 60px 40px; 
      color: var(--text-tertiary);
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.4));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .empty-state h2 { 
      font-family: 'Bebas Neue', sans-serif; 
      font-size: 1.8rem; 
      color: var(--text-secondary); 
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }
    .hidden { display: none !important; }

    /* Missing fields list */
    .missing-list { 
      font-size: 0.75rem; 
      color: #DC2626; 
      margin-top: 6px;
      font-weight: 500;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header-card">
      <div class="gradient-bar"></div>
      <div class="header-content">
        <p class="org">PALABRAS DE VIDA</p>
        <h1>FORMULARIO DE ARTES</h1>
        <p class="event-name">${escapeHtml(eventName)}</p>
        <div class="event-meta">
          ${eventDate ? `
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>${escapeHtml(eventDate)}</span>
            </div>` : ''}
          ${eventLocation ? `
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>${escapeHtml(eventLocation)}</span>
            </div>` : ''}
        </div>
      </div>
    </div>

    ${eventError ? `<p style="color:#991B1B;font-size:0.9rem;margin-bottom:16px;">${escapeHtml(eventError)}</p>` : ''}

    <!-- Gate: Name + Email -->
    <div id="gateSection" class="${eventError ? 'hidden' : ''}">
      <div class="gate-card">
        <h2>IDENTIFICACIÓN / IDENTIFICATION</h2>
        <p>
          Ingrese su nombre y correo para acceder al formulario. / Enter your name and email to access the form.
        </p>
        <input type="text" id="gateName" placeholder="Nombre completo / Full name" />
        <input type="email" id="gateEmail" placeholder="Correo electrónico / Email" />
        <button class="primary-btn" id="gateBtn" onclick="enterForm()">Continuar / Continue</button>
        <p id="gateError" style="color: #991B1B; font-size: 0.85rem; margin-top: 12px; display: none;"></p>
      </div>
    </div>

    <!-- Main Form (hidden until gate passed) -->
    <div id="formSection" class="hidden">
      <div class="gate-card" style="border-left-color: var(--brand-green);">
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
          A continuación encontrará los segmentos de Artes para este evento. 
          Abra cada uno para ingresar los detalles de su presentación. 
          Puede guardar progreso parcial y regresar luego para completar.
          <br/><em>Below you'll find the Arts segments for this event. 
          Open each one to enter your presentation details. 
          You can save partial progress and return later to complete.</em>
        </p>
      </div>
      <div id="accordionContainer"></div>
      <div id="emptyState" class="empty-state hidden">
        <h2>NO HAY SEGMENTOS DE ARTES</h2>
        <p>No se encontraron segmentos de tipo "Artes" para este evento.<br/>
        <em>No "Artes" segments found for this event.</em></p>
      </div>
    </div>
  </div>

  <script>
    // ===== DATA =====
    const SEGMENTS = ${segmentsJson};
    const IS_UNICA = ${isUnicaEvent};
    let submitterName = '';
    let submitterEmail = '';

    // ===== GATE =====
    function enterForm() {
      const name = document.getElementById('gateName').value.trim();
      const email = document.getElementById('gateEmail').value.trim();
      const errEl = document.getElementById('gateError');

      if (!name || name.length < 2) {
        errEl.textContent = 'Por favor ingrese su nombre. / Please enter your name.';
        errEl.style.display = 'block';
        return;
      }
      // Simple email format check (no real auth)
      if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        errEl.textContent = 'Por favor ingrese un correo válido. / Please enter a valid email.';
        errEl.style.display = 'block';
        return;
      }

      submitterName = name;
      submitterEmail = email;
      document.getElementById('gateSection').classList.add('hidden');
      document.getElementById('formSection').classList.remove('hidden');
      renderAccordions();
    }

    // ===== STATUS CALCULATION =====
    function calcStatus(seg) {
      const types = seg.art_types || [];
      if (types.length === 0) return { level: 'incomplete', label: '🔴 Incompleto', missing: ['Tipo de arte / Art type'] };

      const missing = [];
      const hasDance = types.includes('DANCE');
      const hasDrama = types.includes('DRAMA');
      const hasVideo = types.includes('VIDEO');

      // Check for at least one primary asset (Minimum)
      const hasAnySong = !!(seg.dance_song_source || seg.drama_song_source || seg.dance_song_title || seg.drama_song_title);
      const hasVideoLink = !!(seg.video_url);
      const hasRunOfShow = !!(seg.arts_run_of_show_url);
      const hasAnyAsset = hasAnySong || hasVideoLink || hasRunOfShow;

      if (!hasAnyAsset) {
        missing.push('Al menos un enlace (canción, video, o guía) / At least one link');
      }

      // Complete checks
      if (hasDance) {
        if (!seg.dance_start_cue) missing.push('Cue inicio danza / Dance start cue');
        if (!seg.dance_end_cue) missing.push('Cue fin danza / Dance end cue');
        if (seg.dance_has_song && !seg.dance_song_source && !seg.dance_song_title) missing.push('Canción de danza / Dance song');
      }
      if (hasDrama) {
        if (!seg.drama_start_cue) missing.push('Cue inicio drama / Drama start cue');
        if (!seg.drama_end_cue) missing.push('Cue fin drama / Drama end cue');
        if (seg.drama_has_song && !seg.drama_song_source && !seg.drama_song_title) missing.push('Canción de drama / Drama song');
      }
      if (hasVideo) {
        if (!seg.video_url) missing.push('Enlace de video / Video link');
      }
      if (!hasRunOfShow) missing.push('Guía de Artes / Arts Directions');

      if (missing.length === 0) return { level: 'complete', label: '🟢 Completo', missing: [] };
      if (hasAnyAsset) return { level: 'minimum', label: '🟡 Mínimo', missing };
      return { level: 'incomplete', label: '🔴 Incompleto', missing };
    }

    // ===== RENDER =====
    function renderAccordions() {
      const container = document.getElementById('accordionContainer');
      if (SEGMENTS.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
      }

      container.innerHTML = SEGMENTS.map((seg, i) => {
        const status = calcStatus(seg);
        const types = seg.art_types || [];
        const hasDance = types.includes('DANCE');
        const hasDrama = types.includes('DRAMA');
        const hasVideo = types.includes('VIDEO');
        const hasOther = types.includes('OTHER');
        const time12 = seg.start_time ? formatTime(seg.start_time) : '';

        return \`
        <div class="accordion-item" id="acc-\${seg.id}">
          <div class="accordion-header" onclick="toggleAccordion('\${seg.id}')">
            <div class="left">
              <div class="seg-title">\${esc(seg.title)}</div>
              <div class="seg-meta">\${esc(seg.session_name)}\${time12 ? ' • ' + time12 : ''}\${seg.presenter ? ' • ' + esc(seg.presenter) : ''}</div>
              <div class="art-types" id="tags-\${seg.id}">
                \${types.map(t => \`<span class="art-type-tag">\${typeLabel(t)}</span>\`).join('')}
              </div>
              \${status.level !== 'complete' && status.missing.length > 0 ? \`<div class="missing-list">⚠ \${status.missing.slice(0, 2).join(', ')}\${status.missing.length > 2 ? '...' : ''}</div>\` : ''}
            </div>
            <span class="status-badge status-\${status.level}">\${status.label}</span>
            <svg class="chevron" id="chev-\${seg.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <div class="accordion-body" id="body-\${seg.id}">
            \${renderForm(seg, i)}
          </div>
        </div>\`;
      }).join('');
    }

    function renderForm(seg, idx) {
      const types = seg.art_types || [];
      return \`
        <div class="form-section">
          <div class="form-section-title">TIPO DE ARTE / ART TYPE</div>
          <div class="check-group">
            \${['DANCE','DRAMA','VIDEO','OTHER'].map(t => \`
              <label class="check-label \${types.includes(t) ? 'checked' : ''}" id="cl-\${seg.id}-\${t}">
                <input type="checkbox" \${types.includes(t) ? 'checked' : ''} onchange="toggleType('\${seg.id}', '\${t}', this.checked)">
                \${typeLabel(t)}
              </label>
            \`).join('')}
          </div>
        </div>

        <!-- Dance Section -->
        <div id="dance-\${seg.id}" class="\${types.includes('DANCE') ? '' : 'hidden'}">
          <div class="type-section">
            <div class="type-section-title">🩰 DANZA / DANCE</div>
            <div class="form-row">
              <div class="form-group"><label>Handheld Mics</label><input type="number" min="0" value="\${seg.dance_handheld_mics}" onchange="updateField('\${seg.id}','dance_handheld_mics',parseInt(this.value)||0)"></div>
              <div class="form-group"><label>Headset Mics</label><input type="number" min="0" value="\${seg.dance_headset_mics}" onchange="updateField('\${seg.id}','dance_headset_mics',parseInt(this.value)||0)"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Cue de Inicio / Start Cue</label><textarea rows="2" onchange="updateField('\${seg.id}','dance_start_cue',this.value)">\${esc(seg.dance_start_cue)}</textarea></div>
              <div class="form-group"><label>Cue de Fin / End Cue</label><textarea rows="2" onchange="updateField('\${seg.id}','dance_end_cue',this.value)">\${esc(seg.dance_end_cue)}</textarea></div>
            </div>
            <div class="form-group" style="margin-top:8px">
              <label><input type="checkbox" \${seg.dance_has_song ? 'checked' : ''} onchange="updateField('\${seg.id}','dance_has_song',this.checked); toggleSongs('\${seg.id}','dance',this.checked)"> Incluye playlist/canción(es) / Includes playlist/song(s)</label>
            </div>
            <div id="dsongs-\${seg.id}" class="\${seg.dance_has_song ? '' : 'hidden'}">
              \${renderSongSlots(seg, 'dance')}
            </div>
          </div>
        </div>

        <!-- Drama Section -->
        <div id="drama-\${seg.id}" class="\${types.includes('DRAMA') ? '' : 'hidden'}">
          <div class="type-section">
            <div class="type-section-title">🎭 DRAMA</div>
            <div class="form-row">
              <div class="form-group"><label>Handheld Mics</label><input type="number" min="0" value="\${seg.drama_handheld_mics}" onchange="updateField('\${seg.id}','drama_handheld_mics',parseInt(this.value)||0)"></div>
              <div class="form-group"><label>Headset Mics</label><input type="number" min="0" value="\${seg.drama_headset_mics}" onchange="updateField('\${seg.id}','drama_headset_mics',parseInt(this.value)||0)"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Cue de Inicio / Start Cue</label><textarea rows="2" onchange="updateField('\${seg.id}','drama_start_cue',this.value)">\${esc(seg.drama_start_cue)}</textarea></div>
              <div class="form-group"><label>Cue de Fin / End Cue</label><textarea rows="2" onchange="updateField('\${seg.id}','drama_end_cue',this.value)">\${esc(seg.drama_end_cue)}</textarea></div>
            </div>
            <div class="form-group" style="margin-top:8px">
              <label><input type="checkbox" \${seg.drama_has_song ? 'checked' : ''} onchange="updateField('\${seg.id}','drama_has_song',this.checked); toggleSongs('\${seg.id}','drama',this.checked)"> Incluye playlist/canción(es) / Includes playlist/song(s)</label>
            </div>
            <div id="dsongs-drama-\${seg.id}" class="\${seg.drama_has_song ? '' : 'hidden'}">
              \${renderSongSlots(seg, 'drama')}
            </div>
          </div>
        </div>

        <!-- Video Section -->
        <div id="video-\${seg.id}" class="\${types.includes('VIDEO') ? '' : 'hidden'}">
          <div class="type-section">
            <div class="type-section-title">🎬 VIDEO</div>
            <div class="form-group"><label>Nombre del Video / Video Name</label><input type="text" value="\${esc(seg.video_name)}" onchange="updateField('\${seg.id}','video_name',this.value)"></div>
            <div class="form-group"><label>Enlace / Link</label><input type="url" value="\${esc(seg.video_url)}" onchange="updateField('\${seg.id}','video_url',this.value)" placeholder="https://drive.google.com/..."><div class="link-hint \${IS_UNICA ? 'link-hint-strict' : ''}">\${IS_UNICA ? 'Drive/Dropbox/OneDrive solamente. No YouTube.' : 'Preferible: Google Drive, OneDrive, Dropbox.'}</div></div>
            <div class="form-row">
              <div class="form-group"><label>Duración (seg) / Length (sec)</label><input type="number" min="0" value="\${seg.video_length_sec}" onchange="updateField('\${seg.id}','video_length_sec',parseInt(this.value)||0)"></div>
              <div class="form-group"><label>Responsable / Owner</label><input type="text" value="\${esc(seg.video_owner)}" onchange="updateField('\${seg.id}','video_owner',this.value)"></div>
            </div>
          </div>
        </div>

        <!-- Other Section -->
        <div id="other-\${seg.id}" class="\${types.includes('OTHER') ? '' : 'hidden'}">
          <div class="type-section">
            <div class="type-section-title">✨ OTRO / OTHER</div>
            <div class="form-group"><label>Descripción / Description</label><textarea rows="3" onchange="updateField('\${seg.id}','art_other_description',this.value)" placeholder="Describe la presentación: elementos, accesos, transiciones...">\${esc(seg.art_other_description)}</textarea></div>
          </div>
        </div>

        <!-- Arts Directions PDF -->
        <div class="form-section" style="margin-top: 16px">
          <div class="form-section-title">📋 GUÍA DE ARTES / ARTS DIRECTIONS</div>
          <div class="form-group">
            <label>Enlace (PDF/Documento) / Link (PDF/Document)</label>
            <input type="url" value="\${esc(seg.arts_run_of_show_url)}" onchange="updateField('\${seg.id}','arts_run_of_show_url',this.value)" placeholder="https://drive.google.com/...">
            <div class="link-hint">Enlace público (cualquiera con el enlace puede ver) / Public link (anyone with the link can view)</div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-section">
          <div class="form-section-title">📝 NOTAS ADICIONALES / ADDITIONAL NOTES</div>
          <div class="form-group">
            <label>Detalles o instrucciones especiales / Special details or instructions</label>
            <textarea rows="3" onchange="updateField('\${seg.id}','description_details',this.value)" placeholder="Cualquier detalle adicional para el equipo técnico...">\${esc(seg.description_details)}</textarea>
          </div>
        </div>

        <button class="save-btn" id="savebtn-\${seg.id}" onclick="saveSegment('\${seg.id}')">
          💾 GUARDAR PROGRESO / SAVE PROGRESS
        </button>
        <div class="save-status" id="savestatus-\${seg.id}"></div>
      \`;
    }

    function renderSongSlots(seg, prefix) {
      // prefix is 'dance' or 'drama'
      // Song 1 uses legacy fields: {prefix}_song_title, {prefix}_song_source, {prefix}_song_owner
      // Songs 2-3 use: {prefix}_song_{n}_title, {prefix}_song_{n}_url, {prefix}_song_{n}_owner
      const s1Title = seg[prefix + '_song_title'] || '';
      const s1Url = seg[prefix + '_song_source'] || '';
      const s1Owner = seg[prefix + '_song_owner'] || '';
      const s2Title = seg[prefix + '_song_2_title'] || '';
      const s2Url = seg[prefix + '_song_2_url'] || '';
      const s2Owner = seg[prefix + '_song_2_owner'] || '';
      const s3Title = seg[prefix + '_song_3_title'] || '';
      const s3Url = seg[prefix + '_song_3_url'] || '';
      const s3Owner = seg[prefix + '_song_3_owner'] || '';

      return \`
        <div class="song-slot">
          <div style="font-size:0.8rem;font-weight:600;color:#9D174D;margin-bottom:6px">Canción 1 / Song 1</div>
          <input type="text" value="\${esc(s1Title)}" placeholder="Título / Title" onchange="updateField('\${seg.id}','\${prefix}_song_title',this.value)" style="margin-bottom:6px">
          <input type="url" value="\${esc(s1Url)}" placeholder="Enlace / Link" onchange="updateField('\${seg.id}','\${prefix}_song_source',this.value)" style="margin-bottom:2px">
          <div class="link-hint \${IS_UNICA ? 'link-hint-strict' : ''}">\${IS_UNICA ? 'Drive/Dropbox/OneDrive solamente. No Spotify/YouTube.' : 'Preferible: Google Drive, OneDrive, Dropbox.'}</div>
          <input type="text" value="\${esc(s1Owner)}" placeholder="Responsable / Owner" onchange="updateField('\${seg.id}','\${prefix}_song_owner',this.value)">
        </div>
        <div class="song-slot">
          <div style="font-size:0.8rem;font-weight:600;color:#9D174D;margin-bottom:6px">Canción 2 / Song 2 (opcional)</div>
          <input type="text" value="\${esc(s2Title)}" placeholder="Título / Title" onchange="updateField('\${seg.id}','\${prefix}_song_2_title',this.value)" style="margin-bottom:6px">
          <input type="url" value="\${esc(s2Url)}" placeholder="Enlace / Link" onchange="updateField('\${seg.id}','\${prefix}_song_2_url',this.value)" style="margin-bottom:2px">
          <div class="link-hint \${IS_UNICA ? 'link-hint-strict' : ''}">\${IS_UNICA ? 'Drive/Dropbox/OneDrive solamente.' : 'Preferible: Drive, OneDrive, Dropbox.'}</div>
          <input type="text" value="\${esc(s2Owner)}" placeholder="Responsable / Owner" onchange="updateField('\${seg.id}','\${prefix}_song_2_owner',this.value)">
        </div>
        <div class="song-slot">
          <div style="font-size:0.8rem;font-weight:600;color:#9D174D;margin-bottom:6px">Canción 3 / Song 3 (opcional)</div>
          <input type="text" value="\${esc(s3Title)}" placeholder="Título / Title" onchange="updateField('\${seg.id}','\${prefix}_song_3_title',this.value)" style="margin-bottom:6px">
          <input type="url" value="\${esc(s3Url)}" placeholder="Enlace / Link" onchange="updateField('\${seg.id}','\${prefix}_song_3_url',this.value)" style="margin-bottom:2px">
          <div class="link-hint \${IS_UNICA ? 'link-hint-strict' : ''}">\${IS_UNICA ? 'Drive/Dropbox/OneDrive solamente.' : 'Preferible: Drive, OneDrive, Dropbox.'}</div>
          <input type="text" value="\${esc(s3Owner)}" placeholder="Responsable / Owner" onchange="updateField('\${seg.id}','\${prefix}_song_3_owner',this.value)">
        </div>
      \`;
    }

    // ===== HELPERS =====
    function esc(s) { if (s == null) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
    function typeLabel(t) { return { DANCE: '🩰 Danza', DRAMA: '🎭 Drama', VIDEO: '🎬 Video', OTHER: '✨ Otro' }[t] || t; }
    function formatTime(t) { if (!t) return ''; const [h,m] = t.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; return (h%12||12)+':'+String(m).padStart(2,'0')+' '+p; }

    function toggleAccordion(id) {
      const body = document.getElementById('body-' + id);
      const chev = document.getElementById('chev-' + id);
      const isOpen = body.classList.contains('open');
      // Close all others
      document.querySelectorAll('.accordion-body.open').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.chevron.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) { body.classList.add('open'); chev.classList.add('open'); }
    }

    function updateField(segId, field, value) {
      const seg = SEGMENTS.find(s => s.id === segId);
      if (seg) seg[field] = value;
    }

    function toggleType(segId, type, checked) {
      const seg = SEGMENTS.find(s => s.id === segId);
      if (!seg) return;
      const set = new Set(seg.art_types || []);
      if (checked) set.add(type); else set.delete(type);
      seg.art_types = Array.from(set);

      // Toggle visibility
      const typeMap = { DANCE: 'dance', DRAMA: 'drama', VIDEO: 'video', OTHER: 'other' };
      const section = document.getElementById(typeMap[type] + '-' + segId);
      if (section) section.classList.toggle('hidden', !checked);

      // Update checkbox label
      const cl = document.getElementById('cl-' + segId + '-' + type);
      if (cl) cl.classList.toggle('checked', checked);

      // Update tags
      const tagsEl = document.getElementById('tags-' + segId);
      if (tagsEl) tagsEl.innerHTML = seg.art_types.map(t => '<span class="art-type-tag">' + typeLabel(t) + '</span>').join('');
    }

    function toggleSongs(segId, prefix, checked) {
      const el = prefix === 'dance' 
        ? document.getElementById('dsongs-' + segId)
        : document.getElementById('dsongs-drama-' + segId);
      if (el) el.classList.toggle('hidden', !checked);
    }

    // ===== SAVE =====
    async function saveSegment(segId) {
      const seg = SEGMENTS.find(s => s.id === segId);
      if (!seg) return;

      const btn = document.getElementById('savebtn-' + segId);
      const statusEl = document.getElementById('savestatus-' + segId);
      btn.disabled = true;
      btn.textContent = '⏳ Guardando...';
      statusEl.textContent = '';
      statusEl.className = 'save-status';

      // Build payload with only arts-relevant fields
      const payload = {
        segment_id: segId,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        data: {
          art_types: seg.art_types || [],
          // Dance
          dance_has_song: seg.dance_has_song || false,
          dance_handheld_mics: seg.dance_handheld_mics || 0,
          dance_headset_mics: seg.dance_headset_mics || 0,
          dance_start_cue: seg.dance_start_cue || '',
          dance_end_cue: seg.dance_end_cue || '',
          dance_song_title: seg.dance_song_title || '',
          dance_song_source: seg.dance_song_source || '',
          dance_song_owner: seg.dance_song_owner || '',
          dance_song_2_title: seg.dance_song_2_title || '',
          dance_song_2_url: seg.dance_song_2_url || '',
          dance_song_2_owner: seg.dance_song_2_owner || '',
          dance_song_3_title: seg.dance_song_3_title || '',
          dance_song_3_url: seg.dance_song_3_url || '',
          dance_song_3_owner: seg.dance_song_3_owner || '',
          // Drama
          drama_has_song: seg.drama_has_song || false,
          drama_handheld_mics: seg.drama_handheld_mics || 0,
          drama_headset_mics: seg.drama_headset_mics || 0,
          drama_start_cue: seg.drama_start_cue || '',
          drama_end_cue: seg.drama_end_cue || '',
          drama_song_title: seg.drama_song_title || '',
          drama_song_source: seg.drama_song_source || '',
          drama_song_owner: seg.drama_song_owner || '',
          drama_song_2_title: seg.drama_song_2_title || '',
          drama_song_2_url: seg.drama_song_2_url || '',
          drama_song_2_owner: seg.drama_song_2_owner || '',
          drama_song_3_title: seg.drama_song_3_title || '',
          drama_song_3_url: seg.drama_song_3_url || '',
          drama_song_3_owner: seg.drama_song_3_owner || '',
          // Video
          has_video: seg.art_types?.includes('VIDEO') || false,
          video_name: seg.video_name || '',
          video_url: seg.video_url || '',
          video_owner: seg.video_owner || '',
          video_length_sec: seg.video_length_sec || 0,
          video_location: seg.video_location || '',
          // Other
          art_other_description: seg.art_other_description || '',
          arts_run_of_show_url: seg.arts_run_of_show_url || '',
          description_details: seg.description_details || '',
        }
      };

      try {
        const resp = await fetch('/api/functions/submitArtsSegment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || 'Error');

        statusEl.textContent = '✅ Guardado exitosamente / Saved successfully';
        statusEl.className = 'save-status save-success';

        // Recalculate status badge
        const status = calcStatus(seg);
        const badgeEl = document.querySelector('#acc-' + segId + ' .status-badge');
        if (badgeEl) {
          badgeEl.textContent = status.label;
          badgeEl.className = 'status-badge status-' + status.level;
        }
      } catch (err) {
        statusEl.textContent = '❌ Error: ' + err.message;
        statusEl.className = 'save-status save-error';
      }
      btn.disabled = false;
      btn.textContent = '💾 GUARDAR PROGRESO / SAVE PROGRESS';
    }
  </script>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        return new Response("<h1>Error Interno</h1><p>" + escapeHtml(error.message) + "</p>", {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});