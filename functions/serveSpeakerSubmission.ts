import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        const eventIdParam = url.searchParams.get('event_id');

        // --- 1. DATA FETCHING (SSR) ---
        let targetEvent = null;
        let eventError = null;
        let options = [];

        try {
            // STRATEGY: 
            // 1. Look for Weekly Services first (usually more frequent)
            // 2. Look for Special Events if no Weekly Service or if specifically requested?
            // Actually, usually we want to show everything relevant for "This Week".
            // Let's fetch BOTH upcoming Weekly Services AND Confirmed Events.

            const today = new Date();
            // Go back 1 day to include today's services if still active
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayIso = yesterday.toISOString().split('T')[0];

            // 1. Fetch Weekly Services
            // We want active services for the next 7 days
            const services = await base44.asServiceRole.entities.Service.filter({ status: 'active' });
            const upcomingServices = services
                .filter(s => s.date >= yesterdayIso)
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 2); // Next 2 services

            // 2. Fetch Events (if eventIdParam is NOT present, otherwise just fetch that one)
            let upcomingEvents = [];
            if (eventIdParam) {
                const specificEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
                if (specificEvent) upcomingEvents = [specificEvent];
            } else {
                const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
                upcomingEvents = events
                    .filter(e => e.start_date >= yesterdayIso)
                    .sort((a, b) => a.start_date.localeCompare(b.start_date))
                    .slice(0, 1); // Next 1 event
            }

            // --- PROCESS WEEKLY SERVICES ---
            upcomingServices.forEach(service => {
                const slots = ['9:30am', '11:30am'];
                slots.forEach(slot => {
                    const segments = service[slot] || [];
                    segments.forEach((seg, index) => {
                        // Filter for Message/Preach type segments
                        const type = (seg.type || '').toLowerCase();
                        if (type === 'message' || type === 'mensaje' || type === 'plenaria' || type === 'predica') {
                            // Extract speaker name safely
                            const speaker = seg.data?.preacher || seg.data?.presenter || seg.data?.leader || 'TBA';
                            const title = seg.data?.title || seg.title || 'Mensaje';
                            
                            // Create Composite ID: service|{id}|{slot}|{index}
                            const compositeId = `service|${service.id}|${slot}|${index}`;
                            
                            options.push({
                                id: compositeId,
                                title: title,
                                speaker: speaker,
                                message_title: seg.data?.title,
                                time: slot,
                                date: service.date,
                                session_name: service.name || `Servicio ${slot}`,
                                type: 'weekly',
                                sort_date: service.date + 'T' + (slot === '9:30am' ? '09:30' : '11:30')
                            });
                        }
                    });
                });
            });

            // --- PROCESS EVENTS ---
            if (upcomingEvents.length > 0) {
                targetEvent = upcomingEvents[0]; // Primary context for headers if mixed?
                
                // If we have both, maybe prioritize the one closer in time for the header info?
                // For now, let's keep targetEvent as the "Event" context if available.

                for (const evt of upcomingEvents) {
                    const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: evt.id });
                    
                    if (sessions.length > 0) {
                        const segmentPromises = sessions.map(sess => 
                            base44.asServiceRole.entities.Segment.filter({ 
                                session_id: sess.id,
                                segment_type: 'Plenaria'
                            })
                        );
                        
                        const segmentsResults = await Promise.all(segmentPromises);
                        const allSegments = segmentsResults.flat();

                        allSegments.forEach(seg => {
                            const session = sessions.find(s => s.id === seg.session_id);
                            options.push({
                                id: seg.id, // Standard UUID
                                title: seg.title,
                                speaker: seg.presenter || 'TBA',
                                message_title: seg.message_title,
                                time: seg.start_time,
                                date: session?.date,
                                session_name: session?.name || evt.name,
                                type: 'event',
                                sort_date: (session?.date || '1970-01-01') + 'T' + (seg.start_time || '00:00')
                            });
                        });
                    }
                }
            }

            // Sort all options by date/time
            options.sort((a, b) => a.sort_date.localeCompare(b.sort_date));

            // Set display variables based on the first available option if targetEvent wasn't set explicitly
            if (!targetEvent && options.length > 0) {
                // Synthesize a "target event" for the UI header from the first option
                targetEvent = {
                    name: options[0].session_name,
                    location: "Auditorio Principal", // Default
                    start_date: options[0].date
                };
            }

            if (options.length === 0) {
                eventError = "No se encontraron sesiones activas para recibir mensajes.";
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
                optionsHtml += `<optgroup label="${currentGroup}">`;
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

            optionsHtml += `<option value="${opt.id}">${label}</option>`;
        });
        
        // Close last group
        if (currentGroup !== null) optionsHtml += '</optgroup>';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Versículos de su Mensaje | ${eventName}</title>
  <meta property="og:title" content="Versículos de su Mensaje | ${eventName}" />
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
                ${eventError}
            </div>
        ` : ''}

        <div class="form-header">
          <p class="org-name">PALABRAS DE VIDA</p>
          <h1>VERSÍCULOS DE SU MENSAJE</h1>
          <p class="event-name">${eventName}</p>
          <div class="event-meta">
            ${eventDate ? `
            <div class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>${eventDate}</span>
            </div>` : ''}
            ${eventLocation ? `
            <div class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>${eventLocation}</span>
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
      </div>

      <!-- Section 2 -->
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
    
    // Generate idempotency key
    const IDEMPOTENCY_KEY = crypto.randomUUID();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const segmentId = document.getElementById('segmentId').value;
        const content = document.getElementById('content').value;

        if (!segmentId || !content.trim()) return;

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

        return new Response(html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        return new Response("<h1>Error Interno</h1><p>" + error.message + "</p>", { 
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});