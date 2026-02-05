import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Redeploy timestamp: 2026-02-05T12:00:00Z
        // --- 1. PARSE QUERY PARAMS ---
        const url = new URL(req.url);
        const eventId = url.searchParams.get('event_id');

        // --- 2. DATA FETCHING (SSR) ---
        let targetEvent = null;
        let eventError = null;
        let options = [];

        try {
            if (eventId) {
                targetEvent = await base44.asServiceRole.entities.Event.get(eventId);
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
                            speaker: seg.presenter || seg.message_title || 'TBA',
                            time: seg.start_time,
                            date: session?.date,
                            session_name: session?.name,
                            label: `${session?.name || ''} - ${seg.title} (${seg.start_time || 'TBA'})${seg.presenter ? ' - ' + seg.presenter : ''}`
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

        // --- 3. GENERATE HTML ---
        // Using "Bebas Neue" and "Inter" as requested
        // Using provided color variables and structure

        const optionsHtml = options.map(opt => 
            `<option value="${opt.id}">${opt.session_name} • ${opt.speaker} (${opt.title})</option>`
        ).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entrega de Mensaje | ${targetEvent?.name || 'Palabras de Vida'}</title>
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
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid var(--border-light);
      padding: 32px;
    }

    /* === HEADER === */
    .form-header {
      text-align: center;
      margin-bottom: 32px;
      border-bottom: 2px solid var(--brand-teal);
      padding-bottom: 24px;
    }

    .form-header h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 2.5rem;
      color: var(--text-primary);
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .form-header p {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

  <div class="form-container" id="mainContainer">
    ${eventError ? `
        <div class="status-message status-error status-visible">
            ${eventError}
        </div>
    ` : ''}

    <div class="form-header">
      <h1>Entrega de Mensaje</h1>
      <p>${targetEvent?.name || 'Evento'}</p>
    </div>

    <div id="statusMessage" class="status-message"></div>

    <form id="submissionForm">
      <!-- Section 1 -->
      <div class="form-section">
        <h3>Información de la Sesión</h3>
        <div class="form-group">
          <label for="segmentId">Selecciona tu Plenaria <span class="required">*</span></label>
          <select id="segmentId" required>
            <option value="" disabled selected>Selecciona una opción...</option>
            ${optionsHtml}
          </select>
        </div>
      </div>

      <!-- Section 2 -->
      <div class="form-section">
        <h3>Contenido del Mensaje</h3>
        <div class="form-group">
          <label for="content">Notas o Bosquejo <span class="required">*</span></label>
          <textarea 
            id="content" 
            placeholder="Pega aquí tus notas. El sistema extraerá automáticamente los versículos bíblicos." 
            required
          ></textarea>
        </div>
      </div>

      <button type="submit" id="submitBtn">Enviar Mensaje</button>
    </form>
  </div>

  <!-- Success View (Hidden initially) -->
  <div class="form-container hidden" id="successContainer" style="display: none;">
    <div class="success-card">
        <div class="success-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </div>
        <div class="form-header" style="border: none; padding: 0;">
            <h1>¡Mensaje Recibido!</h1>
            <p style="text-transform: none; color: var(--text-secondary);">
                Gracias por enviar tu contenido. El equipo procesará las referencias automáticamente.
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

            // Success
            mainContainer.style.display = 'none';
            successContainer.style.display = 'block';

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
                'Cache-Control': 'no-cache' // Critical for form updates
            }
        });

    } catch (error) {
        return new Response(\`Error del sistema: \${error.message}\`, { status: 500 });
    }
});