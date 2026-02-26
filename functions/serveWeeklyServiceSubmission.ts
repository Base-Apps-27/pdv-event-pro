/**
 * serveWeeklyServiceSubmission
 * 
 * Dynamic weekly service submission form.
 * Reads ServiceSchedule entities to discover ALL active recurring services
 * (any day of week), plus one-off services in the upcoming week.
 * 
 * Entity path (Session + Segment) is the primary resolution.
 * JSON-on-Service fallback uses dynamic slot names from the service record itself.
 * 
 * "Apply to other sessions" logic:
 *   - 2 sibling sessions → single "Apply to all" checkbox
 *   - 3+ sibling sessions → individual checkboxes per session
 * 
 * Decision: "Dynamic weekly submission form" (2026-02-18)
 * Replaces hardcoded 9:30am/11:30am and Sunday-only assumptions.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // DECISION-005 compliant: Derive production base URL from the actual request URL.
        // This is the real production origin (e.g. https://app-name.base44.app),
        // NOT window.location which may be a proxy/preview context.
        const requestUrl = new URL(req.url);
        const productionBaseUrl = requestUrl.origin;

        // --- 1. DATA FETCHING ---
        let serviceGroups = []; // Array of { label, date, serviceId, options: [...], sessionNames: [...] }
        let globalError = null;

        try {
            // Current date in ET
            const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const todayETStr = nowET.toISOString().split('T')[0];
            
            // Calculate a week-ahead cutoff for one-off service discovery
            const weekAhead = new Date(nowET);
            weekAhead.setDate(weekAhead.getDate() + 14); // 2 weeks lookahead
            const weekAheadStr = weekAhead.toISOString().split('T')[0];

            // --- A. Discover all active ServiceSchedule records ---
            let schedules = [];
            try {
                schedules = await base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true });
            } catch (e) {
                console.warn("[SERVE_FORM] Could not fetch ServiceSchedule, will use service-level discovery:", e.message);
            }

            // --- B. Find upcoming services for each schedule ---
            // Fetch all active services with date >= today, sorted by date
            const allActiveServices = await base44.asServiceRole.entities.Service.filter(
                { status: 'active' },
                'date',
                50
            );

            const upcomingServices = allActiveServices.filter(s => s.date >= todayETStr && s.date <= weekAheadStr);

            // For each schedule, find the next matching service
            const processedServiceIds = new Set();
            
            for (const schedule of schedules) {
                const dayServices = upcomingServices.filter(s => 
                    s.day_of_week === schedule.day_of_week &&
                    !processedServiceIds.has(s.id)
                );

                if (dayServices.length === 0) continue;

                // Take the nearest upcoming service for this schedule
                const service = dayServices[0];
                processedServiceIds.add(service.id);

                const group = await buildServiceGroup(base44, service, schedule.sessions || []);
                if (group && group.options.length > 0) {
                    serviceGroups.push(group);
                }
            }

            // --- C. Also find services NOT covered by any schedule (one-off, or no schedule configured) ---
            // This catches: one-off Wednesday services, services on days without a schedule, etc.
            for (const service of upcomingServices) {
                if (processedServiceIds.has(service.id)) continue;
                
                // Skip blueprint services
                if (service.status === 'blueprint') continue;

                processedServiceIds.add(service.id);
                const group = await buildServiceGroup(base44, service, []);
                if (group && group.options.length > 0) {
                    serviceGroups.push(group);
                }
            }

            // --- D. Legacy fallback: if no schedules AND no services found via above,
            //     try the old Sunday-specific query ---
            if (serviceGroups.length === 0) {
                const sundayServices = await base44.asServiceRole.entities.Service.filter(
                    { day_of_week: 'Sunday', status: 'active' },
                    'date',
                    10
                );
                const validSunday = sundayServices.filter(s => s.date >= todayETStr);
                if (validSunday.length > 0) {
                    const group = await buildServiceGroup(base44, validSunday[0], []);
                    if (group && group.options.length > 0) {
                        serviceGroups.push(group);
                    }
                }
            }

            if (serviceGroups.length === 0) {
                globalError = "No se encontraron servicios programados próximamente.";
            }

        } catch (err) {
            console.error("[SERVE_FORM] Data fetching error:", err);
            globalError = "Error cargando datos del servicio.";
        }

        // --- 2. HTML GENERATION ---
        // Build <option> groups — one optgroup per service day
        let optionsHtml = '';
        // Build a JS data structure for the "apply to others" logic
        let siblingMapJS = '{}'; // { compositeId: [{ id: compositeId, label: sessionName }] }
        const siblingMap = {};

        for (const group of serviceGroups) {
            optionsHtml += `<optgroup label="${escapeHtml(group.label)}">`;
            for (const opt of group.options) {
                const safeTitle = escapeHtml(opt.title || '');
                optionsHtml += `<option value="${escapeHtml(opt.id)}" data-title="${safeTitle}" data-service-id="${escapeHtml(opt.serviceId)}">${escapeHtml(opt.label)}</option>`;
            }
            optionsHtml += `</optgroup>`;

            // Build sibling map: for each option, list the OTHER options in the same service
            if (group.options.length > 1) {
                for (const opt of group.options) {
                    siblingMap[opt.id] = group.options
                        .filter(o => o.id !== opt.id)
                        .map(o => ({ id: o.id, label: o.sessionLabel || o.label }));
                }
            }
        }
        siblingMapJS = JSON.stringify(siblingMap);

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envío de Versículos | Palabras de Vida</title>
  <meta property="og:title" content="Envío de Versículos" />
  <meta property="og:description" content="Envíe sus notas para extracción automática de versículos." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-charcoal: #1A1A1A;
      --brand-teal: #1F8A70;
      --brand-green: #8DC63F;
      --text-primary: #111827;
      --text-secondary: #6B7280;
      --bg-light: #F9FAFB;
      --bg-white: #FFFFFF;
      --border-light: #E5E7EB;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f3f4f6;
      color: var(--text-primary);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .form-container {
      width: 100%;
      max-width: 600px;
      background: var(--bg-white);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      border: 1px solid var(--border-light);
      overflow: hidden;
      position: relative;
    }
    .gradient-bar {
      height: 6px;
      background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
    }
    .container-content { padding: 40px 32px 32px; }
    .form-header { text-align: center; margin-bottom: 30px; border-bottom: 1px solid var(--border-light); padding-bottom: 20px; }
    .form-header h1 { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; color: var(--brand-charcoal); line-height: 1; margin-bottom: 8px; }
    .form-header p.subtitle { font-size: 0.9rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-section { margin-bottom: 24px; }
    label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; }
    select, textarea, input[type="text"], input[type="url"] {
      width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white); font-family: inherit;
    }
    textarea { min-height: 200px; resize: vertical; }
    button { width: 100%; padding: 16px; background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%); color: white; font-weight: 700; font-size: 1rem; text-transform: uppercase; border: none; border-radius: 6px; cursor: pointer; }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    .status-message { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9rem; display: none; }
    .status-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; display: block; }
    .status-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; display: block; }
    .hidden { display: none !important; }
    /* Apply-to-others section */
    .apply-others-section {
      display: none;
      margin-bottom: 16px;
    }
    .apply-others-box {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 12px;
    }
    .apply-others-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .apply-others-item:last-child { margin-bottom: 0; }
    .apply-others-item input[type="checkbox"] {
      width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0;
    }
    .apply-others-item label {
      margin: 0; font-size: 0.9rem; font-weight: 500; color: #065f46; text-transform: none; line-height: 1.4;
    }
    .apply-others-item .sub-text {
      font-size: 0.8rem; font-weight: 400; color: #047857; display: block;
    }
  </style>
</head>
<body>
   <div class="form-container" id="mainContainer">
    <div class="gradient-bar"></div>
    <div class="container-content">
        ${globalError ? `<div class="status-message status-error">${globalError}</div>` : ''}

        <div class="form-header">
          <h1>Versículos - Mensaje Semanal</h1>
          <p class="subtitle">Envíe sus notas para extracción de versículos</p>
        </div>

        <div id="statusMessage" class="status-message"></div>

        <form id="submissionForm" class="${globalError ? 'hidden' : ''}">
          <div class="form-section">
            <label for="segmentId">Seleccione su Horario y Nombre <span style="color:red">*</span></label>
            <select id="segmentId" required>
              <option value="" disabled selected>Seleccione...</option>
              ${optionsHtml}
            </select>
          </div>

          <div class="form-section">
            <label for="title">Título del Mensaje</label>
            <input type="text" id="title" placeholder="Título de la predicación (Opcional)">
          </div>

          <div class="form-section">
            <label for="presentationUrl">Enlace a Presentación / Imágenes (Opcional)</label>
            <input type="url" id="presentationUrl" placeholder="https://dropbox.com/..." style="margin-bottom: 8px;">
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <input type="checkbox" id="slidesOnly" style="width: 18px; height: 18px;">
                <label for="slidesOnly" style="margin: 0; font-size: 0.9rem; font-weight: 500; color: var(--text-primary); text-transform: none;">
                    Este material contiene todo el contenido (No se requieren versículos aparte)
                </label>
            </div>

            <div id="notesFieldContainer" style="display: none;">
                <label for="notesUrl">Link de Bosquejo / Notas (PDF o Doc)</label>
                <input type="url" id="notesUrl" placeholder="Enlace a notas para el equipo de medios (Opcional)" style="margin-bottom: 8px;">
            </div>
          </div>

          <div class="form-section">
            <label for="content">Pegue su mensaje completo (para extracción de versículos) <span id="contentStar" style="color:red">*</span></label>
            <textarea id="content" placeholder="No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente." required></textarea>
          </div>

          <!-- Dynamic "apply to other sessions" container -->
          <div id="applyOthersSection" class="apply-others-section">
            <div class="apply-others-box" id="applyOthersBox">
              <!-- Populated dynamically by JS -->
            </div>
          </div>

          <button type="submit" id="submitBtn">Enviar y Procesar</button>
        </form>
    </div>
  </div>

  <!-- Success View -->
  <div class="form-container" id="successContainer" style="display: none;">
    <div class="gradient-bar"></div>
    <div class="container-content" style="text-align: center; padding-top: 60px; padding-bottom: 60px;">
        <div style="font-size: 40px; margin-bottom: 20px;">✅</div>
        <h2 style="font-family: 'Bebas Neue'; font-size: 2rem; color: #1F8A70;">¡Contenido Recibido!</h2>
        <p style="color: #6B7280; margin-bottom: 30px;">Sus notas han sido recibidas y los versículos están siendo procesados.</p>
        <button onclick="window.location.reload()" style="background: white; color: #111827; border: 1px solid #E5E7EB;">Enviar otro</button>
    </div>
  </div>

  <script>
    // Sibling map: { compositeId: [{ id, label }] }
    const SIBLING_MAP = ${siblingMapJS};

    const form = document.getElementById('submissionForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const mainContainer = document.getElementById('mainContainer');
    const successContainer = document.getElementById('successContainer');
    const segmentSelect = document.getElementById('segmentId');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const slidesOnlyCheckbox = document.getElementById('slidesOnly');
    const contentStar = document.getElementById('contentStar');
    const notesContainer = document.getElementById('notesFieldContainer');
    const applyOthersSection = document.getElementById('applyOthersSection');
    const applyOthersBox = document.getElementById('applyOthersBox');

    // Toggle content requirement based on slidesOnly
    if (slidesOnlyCheckbox) {
        slidesOnlyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (notesContainer) notesContainer.style.display = 'block';
                contentInput.removeAttribute('required');
                if (contentStar) contentStar.style.display = 'none';
                contentInput.placeholder = "Si marcó 'Solo Slides', este campo es opcional.";
            } else {
                if (notesContainer) notesContainer.style.display = 'none';
                contentInput.setAttribute('required', 'true');
                if (contentStar) contentStar.style.display = 'inline';
                contentInput.placeholder = "No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente.";
            }
        });
    }

    // On segment selection change: populate title + build "apply to others" checkboxes
    segmentSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (!selectedOption) return;

        // Auto-populate title
        titleInput.value = selectedOption.dataset.title || "";

        // Build "apply to others" UI
        const selectedId = selectedOption.value;
        const siblings = SIBLING_MAP[selectedId] || [];

        if (siblings.length === 0) {
            // No siblings — hide section
            applyOthersSection.style.display = 'none';
            applyOthersBox.innerHTML = '';
            return;
        }

        applyOthersSection.style.display = 'block';

        if (siblings.length === 1) {
            // Exactly 1 sibling → single "Apply to all" checkbox
            applyOthersBox.innerHTML = '<div class="apply-others-item">' +
                '<input type="checkbox" id="applyAll" class="apply-sibling-cb" data-target-id="' + escapeAttr(siblings[0].id) + '">' +
                '<label for="applyAll">' +
                    'Aplicar también al servicio de ' + escapeText(siblings[0].label) + '<br>' +
                    '<span class="sub-text">El mismo mensaje y versículos se aplicarán a ambos servicios.</span>' +
                '</label>' +
            '</div>';
        } else {
            // 2+ siblings → individual checkboxes
            let html = '<div style="margin-bottom: 8px; font-size: 0.85rem; font-weight: 600; color: #065f46; text-transform: uppercase;">Aplicar también a:</div>';
            siblings.forEach((sib, idx) => {
                const cbId = 'applySibling_' + idx;
                html += '<div class="apply-others-item">' +
                    '<input type="checkbox" id="' + cbId + '" class="apply-sibling-cb" data-target-id="' + escapeAttr(sib.id) + '">' +
                    '<label for="' + cbId + '">' + escapeText(sib.label) + '</label>' +
                '</div>';
            });
            applyOthersBox.innerHTML = html;
        }
    });

    function escapeAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function escapeText(str) { return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const IDEMPOTENCY_KEY = crypto.randomUUID();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const segmentId = segmentSelect.value;
        const content = contentInput.value;
        const title = titleInput.value;
        const presentationUrl = document.getElementById('presentationUrl').value;
        const notesUrl = document.getElementById('notesUrl')?.value || '';
        const slidesOnly = slidesOnlyCheckbox?.checked || false;

        if (!segmentId) return;
        if (!slidesOnly && !content.trim()) return;

        // Collect checked sibling target IDs
        const checkedTargets = [];
        document.querySelectorAll('.apply-sibling-cb:checked').forEach(cb => {
            checkedTargets.push(cb.dataset.targetId);
        });

        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';
        statusMsg.style.display = 'none';

        try {
            const response = await fetch('${productionBaseUrl}/functions/submitWeeklyServiceContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_id: segmentId,
                    content: content,
                    title: title,
                    presentation_url: presentationUrl,
                    notes_url: notesUrl,
                    content_is_slides_only: slidesOnly,
                    mirror_target_ids: checkedTargets,
                    idempotencyKey: IDEMPOTENCY_KEY
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Error en la solicitud');
            }

            mainContainer.style.display = 'none';
            successContainer.style.display = 'block';

        } catch (err) {
            console.error(err);
            statusMsg.className = 'status-message status-error';
            statusMsg.innerText = err.message || 'Error al enviar. Intente nuevamente.';
            statusMsg.style.display = 'block';
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
                'Cache-Control': 'no-store, no-cache',
            }
        });

    } catch (error) {
        return new Response("<h1>Error Interno</h1><p>" + error.message + "</p>", { 
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});

// ---- Helper Functions ----

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build a service group (options list) for a single Service record.
 * Tries Entity path first (Sessions + Segments), falls back to JSON-on-Service.
 * 
 * Returns: { label, date, serviceId, options: [{ id, label, title, serviceId, sessionLabel }], sessionNames: [] }
 */
async function buildServiceGroup(base44, service, scheduleSessions) {
    // Format display date
    const svcDate = new Date(service.date + 'T12:00:00');
    const formattedDate = svcDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric', year: '2-digit' });
    const label = `${service.name || service.day_of_week} — ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`;

    const options = [];
    const sessionNames = [];

    // --- Entity path: Sessions + Segments ---
    try {
        const sessions = await base44.asServiceRole.entities.Session.filter({
            service_id: service.id
        });

        if (sessions.length > 0) {
            for (const session of sessions.sort((a, b) => (a.order || 0) - (b.order || 0))) {
                const segments = await base44.asServiceRole.entities.Segment.filter(
                    { session_id: session.id }, 'order'
                );
                segments.forEach((seg, idx) => {
                    const type = (seg.segment_type || "").toLowerCase();
                    if (['plenaria', 'message', 'predica', 'mensaje'].includes(type)) {
                        const compositeId = `weekly_service|${service.id}|${session.name}|${idx}|message`;
                        const presenter = seg.presenter || "Sin asignar";
                        options.push({
                            id: compositeId,
                            label: `${session.name} - ${presenter}`,
                            sessionLabel: session.name,
                            title: seg.message_title || "",
                            serviceId: service.id,
                        });
                        if (!sessionNames.includes(session.name)) sessionNames.push(session.name);
                    }
                });
            }
            if (options.length > 0) return { label, date: service.date, serviceId: service.id, options, sessionNames };
        }
    } catch (e) {
        console.warn("[SERVE_FORM] Entity path failed for service", service.id, e.message);
    }

    // --- JSON fallback: discover slot keys dynamically from the service record ---
    // Look for array-typed properties on the service that look like time slots
    // (ServiceSchedule sessions provide hints, but we also scan the service object itself)
    const knownSlotNames = scheduleSessions.map(s => s.name);
    const allKeys = Object.keys(service);
    
    // Heuristic: a key is a time slot if it's an array of segment-like objects
    // or if it matches a known session name from the schedule
    const slotKeys = [];
    for (const key of allKeys) {
        if (knownSlotNames.includes(key)) {
            slotKeys.push(key);
        } else if (
            Array.isArray(service[key]) &&
            service[key].length > 0 &&
            typeof service[key][0] === 'object' &&
            service[key][0] !== null &&
            ('type' in service[key][0] || 'title' in service[key][0])
        ) {
            // Looks like a segments array — but skip known non-slot arrays
            const skipKeys = ['segments', 'selected_announcements'];
            if (!skipKeys.includes(key)) {
                slotKeys.push(key);
            }
        }
    }

    for (const slot of slotKeys) {
        if (!Array.isArray(service[slot])) continue;
        service[slot].forEach((seg, idx) => {
            const type = (seg.type || "").toLowerCase();
            if (['message', 'plenaria', 'predica', 'mensaje'].includes(type)) {
                const compositeId = `weekly_service|${service.id}|${slot}|${idx}|message`;
                const presenter = seg.data?.preacher || seg.data?.presenter || seg.data?.leader || "Sin asignar";
                options.push({
                    id: compositeId,
                    label: `${slot} - ${presenter}`,
                    sessionLabel: slot,
                    title: seg.message_title || seg.data?.message_title || seg.data?.title || "",
                    serviceId: service.id,
                });
                if (!sessionNames.includes(slot)) sessionNames.push(slot);
            }
        });
    }

    if (options.length > 0) return { label, date: service.date, serviceId: service.id, options, sessionNames };
    return null;
}