import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // --- 1. DATA FETCHING ---
        let options = [];
        let serviceError = null;
        let formattedDate = "";

        try {
            // Find next upcoming Sunday
            const today = new Date();
            const day = today.getDay(); // 0 = Sunday
            const daysUntilSunday = day === 0 ? 0 : 7 - day; 
            
            // If today is Sunday, do we show today? 
            // If it's late in the day, maybe next Sunday? 
            // For simplicity, let's show "Upcoming Sunday" as today if today is Sunday, or next Sunday.
            // Adjust logic if needed. Let's stick to strict "Next Sunday" if today is passed?
            // User requirement: "Upcoming Sunday".
            
            const nextSunday = new Date(today);
            nextSunday.setDate(today.getDate() + daysUntilSunday);
            // Format YYYY-MM-DD
            const dateStr = nextSunday.toISOString().split('T')[0];
            
            // Format for display (e.g. Domingo 12/03/26)
            formattedDate = nextSunday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric', year: '2-digit' });
            formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1); // Capitalize

            // Fetch Service for this date
            const services = await base44.asServiceRole.entities.Service.filter({ date: dateStr });
            // Filter for active/valid services (similar to WeeklyServiceManager logic)
            const validServices = services.filter(s => 
                (s["9:30am"]?.length > 0 || s["11:30am"]?.length > 0) &&
                (!s.segments || s.segments.length === 0) // Exclude custom services if any mix-up
            );

            if (validServices.length > 0) {
                const service = validServices[0]; // Assume one main service per Sunday
                
                // Extract Message segments
                const processTimeSlot = (slot) => {
                    if (!service[slot]) return;
                    service[slot].forEach((seg, idx) => {
                        // Normalize type check
                        const type = (seg.type || "").toLowerCase();
                        if (type === 'message' || type === 'plenaria' || type === 'predica' || type === 'mensaje') {
                            
                            // Composite ID: weekly_service|{serviceId}|{timeSlot}|{segmentIdx}|message
                            const compositeId = `weekly_service|${service.id}|${slot}|${idx}|message`;
                            
                            let presenter = seg.data?.preacher || seg.data?.presenter || seg.data?.leader || "Sin asignar";
                            
                            options.push({
                                id: compositeId,
                                label: `${slot} - ${presenter}`,
                                group: formattedDate,
                                title: seg.message_title || seg.data?.message_title || seg.data?.title || ""
                            });
                        }
                    });
                };

                processTimeSlot("9:30am");
                processTimeSlot("11:30am");
            } else {
                serviceError = "No se encontraron servicios programados para el próximo domingo.";
            }

        } catch (err) {
            console.error("Data fetching error:", err);
            serviceError = "Error cargando datos del servicio.";
        }

        // --- 2. HTML GENERATION ---
        let optionsHtml = '';
        if (options.length > 0) {
            optionsHtml += `<optgroup label="${formattedDate}">`;
            options.forEach(opt => {
                const safeTitle = (opt.title || "").replace(/"/g, '&quot;');
                optionsHtml += `<option value="${opt.id}" data-title="${safeTitle}">${opt.label}</option>`;
            });
            optionsHtml += `</optgroup>`;
        }

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envío de Versículos Dominical | Palabras de Vida</title>
  <meta property="og:title" content="Envío de Versículos Dominical" />
  <meta property="og:description" content="Envíe sus notas para extracción automática de versículos." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Reuse styles from event form for consistency */
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
    select, textarea { width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white); }
    textarea { min-height: 200px; resize: vertical; font-family: 'Inter', sans-serif; }
    button { width: 100%; padding: 16px; background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%); color: white; font-weight: 700; font-size: 1rem; text-transform: uppercase; border: none; border-radius: 6px; cursor: pointer; }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    .status-message { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9rem; display: none; }
    .status-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; display: block; }
    .status-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; display: block; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
   <div class="form-container" id="mainContainer">
    <div class="gradient-bar"></div>
    <div class="container-content">
        ${serviceError ? `<div class="status-message status-error">${serviceError}</div>` : ''}

        <div class="form-header">
          <h1>Versículos - Mensaje Dominical</h1>
          <p class="subtitle">Próximo Domingo: ${formattedDate}</p>
        </div>

        <div id="statusMessage" class="status-message"></div>

        <form id="submissionForm" class="${serviceError ? 'hidden' : ''}">
          <div class="form-section">
            <label for="segmentId">Seleccione su Horario y Nombre <span style="color:red">*</span></label>
            <select id="segmentId" required>
              <option value="" disabled selected>Seleccione...</option>
              ${optionsHtml}
            </select>
          </div>

          <div class="form-section">
            <label for="title">Título del Mensaje</label>
            <input type="text" id="title" placeholder="Título de la predicación (Opcional)" style="width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white);">
          </div>

          <div class="form-section">
            <label for="presentationUrl">Enlace a Presentación / Imágenes (Opcional)</label>
            <input type="url" id="presentationUrl" placeholder="https://dropbox.com/..." style="width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white); margin-bottom: 8px;">
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <input type="checkbox" id="slidesOnly" style="width: 18px; height: 18px;">
                <label for="slidesOnly" style="margin: 0; font-size: 0.9rem; font-weight: 500; color: var(--text-primary); text-transform: none;">
                    Este material contiene todo el contenido (No se requieren versículos aparte)
                </label>
            </div>

            <div id="notesFieldContainer" style="display: none;">
                <label for="notesUrl">Link de Bosquejo / Notas (PDF o Doc)</label>
                <input type="url" id="notesUrl" placeholder="Enlace a notas para el equipo de medios (Opcional)" style="width: 100%; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 1rem; background: var(--bg-white); margin-bottom: 8px;">
            </div>
          </div>

          <div class="form-section">
            <label for="content">Pegue su mensaje completo (para extracción de versículos) <span style="color:red">*</span></label>
            <textarea id="content" placeholder="No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente." required></textarea>
          </div>

          <!-- Apply to both services checkbox — only shown when 9:30am segment selected -->
          <div id="applyBothContainer" style="display: none; margin-bottom: 16px;">
            <div style="display: flex; align-items: flex-start; gap: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px;">
                <input type="checkbox" id="applyBoth" style="width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0;">
                <label for="applyBoth" style="margin: 0; font-size: 0.9rem; font-weight: 500; color: #065f46; text-transform: none; line-height: 1.4;">
                    Aplicar también al servicio de 11:30 AM<br>
                    <span style="font-size: 0.8rem; font-weight: 400; color: #047857;">El mismo mensaje y versículos se aplicarán a ambos servicios.</span>
                </label>
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
    const form = document.getElementById('submissionForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const mainContainer = document.getElementById('mainContainer');
    const successContainer = document.getElementById('successContainer');
    const segmentSelect = document.getElementById('segmentId');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const slidesOnlyCheckbox = document.getElementById('slidesOnly');
    const contentLabelStar = document.querySelector('label[for="content"] span');
    const notesContainer = document.getElementById('notesFieldContainer');

    // Toggle content requirement based on slidesOnly
    if (slidesOnlyCheckbox) {
        slidesOnlyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Show Notes field
                if (notesContainer) notesContainer.style.display = 'block';
                
                // Make content optional
                contentInput.removeAttribute('required');
                if (contentLabelStar) contentLabelStar.style.display = 'none';
                contentInput.placeholder = "Si marcó 'Solo Slides', este campo es opcional. Puede dejarlo vacío o agregar notas para el equipo de proyección.";
            } else {
                // Hide Notes field
                if (notesContainer) notesContainer.style.display = 'none';

                // Make content required
                contentInput.setAttribute('required', 'true');
                if (contentLabelStar) contentLabelStar.style.display = 'inline';
                contentInput.placeholder = "No necesita separar los versículos manualmente. Simplemente pegue su bosquejo o notas completas aquí, y el sistema detectará y extraerá las referencias bíblicas automáticamente.";
            }
        });
    }
    
    const applyBothContainer = document.getElementById('applyBothContainer');
    const applyBothCheckbox = document.getElementById('applyBoth');

    // Auto-populate title on selection change + toggle "apply to both" checkbox
    segmentSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption) {
            // Always update the title field (populating it or clearing it) based on the selection
            titleInput.value = selectedOption.dataset.title || "";

            // Show "apply to both" only when a 9:30am segment is selected
            // Composite ID format: weekly_service|{serviceId}|{timeSlot}|{segmentIdx}|message
            const compositeId = selectedOption.value || '';
            const is930 = compositeId.includes('|9:30am|');
            if (applyBothContainer) {
                applyBothContainer.style.display = is930 ? 'block' : 'none';
                // Reset checkbox when switching segments
                if (applyBothCheckbox) applyBothCheckbox.checked = false;
            }
        }
    });

    const IDEMPOTENCY_KEY = crypto.randomUUID();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const segmentId = segmentSelect.value;
        const content = document.getElementById('content').value;
        const title = titleInput.value;
        const presentationUrl = document.getElementById('presentationUrl').value;
        const notesUrl = document.getElementById('notesUrl').value;
        const slidesOnly = document.getElementById('slidesOnly').checked;

        // Validation: Content is required ONLY if not slidesOnly
        if (!segmentId) return;
        if (!slidesOnly && !content.trim()) return;

        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';
        statusMsg.style.display = 'none';

        try {
            const response = await fetch('/api/functions/submitWeeklyServiceContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment_id: segmentId,
                    content: content,
                    title: title,
                    presentation_url: presentationUrl,
                    notes_url: notesUrl,
                    content_is_slides_only: slidesOnly,
                    apply_to_both_services: applyBothCheckbox ? applyBothCheckbox.checked : false,
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

        return new Response(html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
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