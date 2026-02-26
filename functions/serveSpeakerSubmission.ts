import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CRIT-1 FIX: HTML escape function to prevent XSS attacks
 * All user-controlled strings interpolated into HTML must be escaped
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

        // DECISION-005 compliant: Derive production base URL from the actual request URL.
        // This is the real production origin (e.g. https://app-name.base44.app),
        // NOT window.location which may be a proxy/preview context.
        const productionBaseUrl = url.origin;

        // --- 1. DATA FETCHING (SSR) ---
        let targetEvent = null;
        let eventError = null;
        let options = [];

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
                    // Fallback to in_progress
                    const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
                    if (progress.length > 0) targetEvent = progress[0];
                }
            }

            if (targetEvent) {
                // Fetch Sessions
                const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
                
                if (sessions.length > 0) {
                     // Fetch Plenaria Segments (Parallelized)
                    const segmentPromises = sessions.map(sess => 
                        base44.asServiceRole.entities.Segment.filter({ 
                            session_id: sess.id,
                            segment_type: 'Plenaria'
                        })
                    );
                    
                    const segmentsResults = await Promise.all(segmentPromises);
                    const allSegments = segmentsResults.flat();

                    // Format Options
                    options = allSegments.map(seg => {
                        const session = sessions.find(s => s.id === seg.session_id);
                        return {
                            id: seg.id,
                            title: seg.title,
                            speaker: seg.presenter || 'TBA',
                            message_title: seg.message_title, // Added as requested
                            time: seg.start_time,
                            date: session?.date,
                            session_name: session?.name,
                            label: `${session?.name || ''} - ${seg.title} (${seg.start_time || 'TBA'})`
                        };
                    });

                    // Sort
                    options.sort((a, b) => {
                        const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
                        const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
                        return da - db;
                    });
                }
            } else {
                eventError = "No se encontró un evento activo.";
            }

        } catch (err) {
            console.error("Data fetching error:", err);
            eventError = "Error cargando datos del evento.";
        }

        // --- 2. HTML GENERATION ---
        const eventName = targetEvent ? targetEvent.name : "Evento";
        const eventLocation = targetEvent?.location || "";
        const eventDate = targetEvent?.start_date 
            ? new Date(targetEvent.start_date + "T12:00:00").toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) 
            : "";
        
        // Generate Options HTML with Groups
        let optionsHtml = '';
        let currentGroup = null;

        options.forEach(opt => {
            const groupName = opt.session_name || "Otras Sesiones";
            
            // Start new group if needed
            if (groupName !== currentGroup) {
                if (currentGroup !== null) optionsHtml += '</optgroup>';
                currentGroup = groupName;
                optionsHtml += `<optgroup label="${escapeHtml(currentGroup)}">`;
            }

            // Simplified Label: Speaker • "Title" (or Segment Name)
            // Removes the session name redundancy since it's in the group label
            let label = opt.speaker;
            
            if (opt.message_title) {
                // If we have a specific message title, show it nicely
                // Check if title is already quoted, if not add quotes for clarity
                const title = opt.message_title.trim();
                const isQuoted = title.startsWith('"') || title.startsWith("'");
                label += ` • ${isQuoted ? title : '"' + title + '"'}`;
            } else {
                // Fallback to just the segment title (e.g. Plenaria #1)
                label += ` • ${opt.title}`;
            }

            optionsHtml += `<option value="${escapeHtml(opt.id)}">${escapeHtml(label)}</option>`;
        });
        
        // Close last group
        if (currentGroup !== null) optionsHtml += '</optgroup>';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Versículos de su Mensaje | ${escapeHtml(eventName)}</title>
  <meta property="og:title" content="Versículos de su Mensaje | ${escapeHtml(eventName)}" />
  <meta property="og:description" content="Comparta sus notas o bosquejo para la proyección de versículos." />
  <meta property="og:type" content="website" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* === CSS VARIABLES === */
    :root {
      --brand-charcoal: #1A1A1A;
      --brand-teal: #1F8A70;
      --brand-green: #8DC63F;
      --brand-yellow: #D7DF23;
      
      --text-primary: #111827;
      --text-secondary: #6B7280;
      --text-tertiary: #9CA3AF;
      --border-light: #E5E7EB;
      --bg-light: #F9FAFB;
      --bg-white: #FFFFFF;
      --bg-gradient-start: #f9fafb;
      --bg-gradient-end: #f3f4f6;
    }

    /* === RESET === */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* === BODY === */
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* === CONTAINER === */
    .form-container {
      width: 100%;
      max-width: 600px;
      background: var(--bg-white);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      border: 1px solid var(--border-light);
      padding: 0; /* padding moved to inner elements or handled by margins */
      overflow: hidden; /* for gradient bar */
      position: relative;
    }
    
    .container-content {
        padding: 40px 32px 32px 32px;
    }

    /* === HEADER === */
    .form-header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-light);
      position: relative;
    }

    .form-header h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 3rem;
      color: var(--brand-charcoal);
      letter-spacing: 0.02em;
      margin-bottom: 8px;
      line-height: 1;
    }

    .form-header p.org-name {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--brand-teal);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 4px;
    }

    .form-header p.event-name {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-header .event-meta {
      font-size: 0.85rem;
      color: var(--text-tertiary);
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
      font-weight: 500;
    }
    
    .meta-item { display: flex; align-items: center; gap: 6px; }
    .meta-icon { width: 14px; height: 14px; color: var(--brand-green); }
    
    .gradient-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
    }
    
    .instruction-text {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin-top: -12px;
        margin-bottom: 24px;
        line-height: 1.4;
    }

    /* === STATUS MESSAGES === */
    .status-message {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
      font-size: 0.95rem;
      display: none; /* hidden by default */
      align-items: center;
      gap: 12px;
    }
    
    .status-visible { display: flex; }

    .status-success {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }

    .status-error {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .status-loading {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }

    /* === SECTIONS === */
    .form-section {
      background: var(--bg-light);
      border-radius: 8px;
      border-left: 4px solid var(--brand-teal);
      padding: 24px;
      margin-bottom: 24px;
    }

    .form-section h3 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.25rem;
      color: var(--brand-teal);
      margin-bottom: 16px;
      letter-spacing: 0.05em;
    }

    /* === FORM ELEMENTS === */
    .form-group { margin-bottom: 16px; }
    
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .required { color: #dc2626; margin-left: 2px; }

    select, textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      background: var(--bg-white);
      color: var(--text-primary);
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    select:focus, textarea:focus {
      outline: none;
      border-color: var(--brand-teal);
      box-shadow: 0 0 0 3px rgba(31, 138, 112, 0.1);
    }

    textarea {
      min-height: 180px;
      resize: vertical;
    }

    /* === BUTTON === */
    button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
      color: white;
      font-family: inherit;
      font-weight: 700;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }

    button:hover {
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    /* === SUCCESS STATE === */
    .hidden { display: none !important; }

    .success-card {
      text-align: center;
      padding: 40px 20px;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: #d1fae5;
      color: #059669;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon svg { width: 32px; height: 32px; }
  </style>
</head>
<body>
   <!-- Version: ${new Date().toISOString()} - List Grouping Update -->
   <div class="form-container" id="mainContainer">
    <div class="gradient-bar"></div>
    <div class="container-content">
        ${eventError ? `
            <div class="status-message status-error status-visible">
                ${escapeHtml(eventError)}
            </div>
        ` : ''}

        <div class="form-header">
          <p class="org-name">PALABRAS DE VIDA</p>
          <h1>VERSÍCULOS DE SU MENSAJE</h1>
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

        <div id="statusMessage" class="status-message"></div>

        <form id="submissionForm" class="${eventError ? 'hidden' : ''}">
      <!-- Section 1 -->
      <div class="form-section">
        <h3>Información de la Sesión</h3>
        <div class="form-group">
          <label for="segmentId">Seleccione su Plenaria <span class="required">*</span></label>
          <select id="segmentId" required>
            <option value="" disabled selected>Seleccione una opción...</option>
            ${optionsHtml}
          </select>
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label for="title">Título del Mensaje (Opcional)</label>
          <input type="text" id="title" placeholder="Título de la predicación">
        </div>
      </div>

      <!-- Section 2 -->
      <div class="form-section">
        <h3>Material Visual y Notas</h3>
        <div class="form-group">
          <label for="presentationUrl">Enlace a Presentación / Imágenes (Opcional)</label>
          <input type="url" id="presentationUrl" placeholder="https://drive.google.com/..." style="width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white); margin-bottom: 8px;">
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <input type="checkbox" id="slidesOnly" style="width: 18px; height: 18px;">
            <label for="slidesOnly" style="margin: 0; font-size: 0.9rem; font-weight: 500; color: var(--text-primary); text-transform: none;">
                Este material contiene todo el contenido (No se requieren versículos aparte)
            </label>
        </div>
        <div class="form-group" id="notesFieldContainer" style="display: none;">
            <label for="notesUrl">Link de Bosquejo / Notas (PDF o Doc)</label>
            <input type="url" id="notesUrl" placeholder="Enlace a notas para el equipo de medios (Opcional)" style="width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white);">
        </div>
      </div>

      <!-- Section 3 -->
      <div class="form-section">
        <h3>Versículos Para Proyección</h3>
        <p class="instruction-text">
            Para proyectar sus textos bíblicos en pantalla, necesitamos identificarlos. Por favor, <strong>pegue aquí sus notas o bosquejo completo</strong>. Nuestro sistema identificará y extraerá automáticamente todos los versículos por usted.
        </p>
        <div class="form-group">
          <label for="content">Pegue sus notas aquí (El sistema detectará los versículos) <span class="required">*</span></label>
          <textarea 
            id="content" 
            placeholder="No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto." 
            required
          ></textarea>
        </div>
      </div>

      <button type="submit" id="submitBtn">Enviar Mensaje</button>
    </form>
  </div>

  <!-- Success View (Hidden initially) -->
  <div class="form-container" id="successContainer" style="display: none;">
    <div class="gradient-bar"></div>
    <div class="success-card">
        <div class="success-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </div>
        <div class="form-header" style="border: none; padding: 0;">
            <h1>¡Mensaje Recibido!</h1>
            <p style="text-transform: none; color: var(--text-secondary);">
                Gracias por enviar su contenido. El equipo procesará las referencias automáticamente.
            </p>
        </div>
        <button onclick="window.location.reload()" style="background: white; color: var(--text-primary); border: 1px solid var(--border-light);">
            Enviar otro mensaje
        </button>
    </div>
  </div>

  <script>
    const form = document.getElementById('submissionForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const mainContainer = document.getElementById('mainContainer');
    const successContainer = document.getElementById('successContainer');
    const contentInput = document.getElementById('content');
    const slidesOnlyCheckbox = document.getElementById('slidesOnly');
    const contentLabelStar = document.querySelector('label[for="content"] .required');
    const notesContainer = document.getElementById('notesFieldContainer');

    // Toggle content requirement based on slidesOnly
    if (slidesOnlyCheckbox) {
        slidesOnlyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (notesContainer) notesContainer.style.display = 'block';
                contentInput.removeAttribute('required');
                if (contentLabelStar) contentLabelStar.style.display = 'none';
                contentInput.placeholder = "Si marcó 'Solo Slides', este campo es opcional. Puede dejarlo vacío o agregar notas para el equipo de proyección.";
            } else {
                if (notesContainer) notesContainer.style.display = 'none';
                contentInput.setAttribute('required', 'true');
                if (contentLabelStar) contentLabelStar.style.display = 'inline';
                contentInput.placeholder = "No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto.";
            }
        });
    }
    
    // Generate idempotency key
    const IDEMPOTENCY_KEY = crypto.randomUUID();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const segmentId = document.getElementById('segmentId').value;
        const content = document.getElementById('content').value;
        const title = document.getElementById('title')?.value || '';
        const presentationUrl = document.getElementById('presentationUrl').value;
        const notesUrl = document.getElementById('notesUrl')?.value || '';
        const slidesOnly = document.getElementById('slidesOnly').checked;

        // Validation: Content is required ONLY if not slidesOnly
        if (!segmentId) return;
        if (!slidesOnly && !content.trim()) return;

        // Loading State
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';
        statusMsg.className = 'status-message status-loading status-visible';
        statusMsg.innerText = 'Enviando mensaje...';

        try {
            const response = await fetch('/api/functions/submitSpeakerContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_id: segmentId,
                    content: content,
                    title: title,
                    presentation_url: presentationUrl,
                    notes_url: notesUrl,
                    content_is_slides_only: slidesOnly,
                    idempotencyKey: IDEMPOTENCY_KEY
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Error en la solicitud');
            }

            // Success - Swap content into the visible container
            if (mainContainer && successContainer) {
                // We replace the content of the currently visible container to ensure the success message is seen
                mainContainer.innerHTML = successContainer.innerHTML;
                window.scrollTo(0, 0);
            } else {
                alert('Mensaje enviado correctamente.');
                window.location.reload();
            }

        } catch (err) {
            console.error(err);
            statusMsg.className = 'status-message status-error status-visible';
            statusMsg.innerText = err.message || 'Error al enviar. Intente nuevamente.';
            submitBtn.disabled = false;
            submitBtn.innerText = 'ENVIAR MENSAJE';
        }
    });
  </script>
</body>
</html>`;

        // CSP: allow inline scripts/styles, cdnjs, Google Fonts
        const cspHeader = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'";

        return new Response(html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': cspHeader,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        // CRIT-1 FIX: Escape error message in HTML response
        return new Response("<h1>Error Interno</h1><p>" + escapeHtml(error.message) + "</p>", { 
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});