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
                            speaker: seg.presenter || seg.message_title || 'TBA',
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

        // --- 2. HTML RENDERING ---
        const eventName = targetEvent ? targetEvent.name : "Evento";
        
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Entrega de Mensaje - ${eventName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <!-- Updated to Bebas Neue for brand consistency v2026.02.04-redeploy -->
    <style>
        :root {
            --brand-teal: #1F8A70;
            --brand-green: #8DC63F;
            --brand-yellow: #D7DF23;
            --text-primary: #111827;
            --text-secondary: #6B7280;
            --border-light: #E5E7EB;
            --bg-light: #F9FAFB;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        }

        .form-container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 24px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .form-header {
            margin-bottom: 32px;
            text-align: center;
            border-bottom: 2px solid var(--brand-teal);
            padding-bottom: 24px;
        }

        .form-header h1 {
            font-family: 'Bebas Neue', sans-serif;
            text-transform: uppercase;
            font-size: 2rem;
            margin-bottom: 8px;
            color: var(--text-primary);
            letter-spacing: 0.05em;
        }

        .form-header p {
            font-size: 0.95rem;
            color: var(--text-secondary);
        }

        .form-section {
            margin-bottom: 32px;
            padding: 24px;
            background: var(--bg-light);
            border-radius: 8px;
            border-left: 4px solid var(--brand-teal);
        }

        .form-section h3 {
            font-family: 'Bebas Neue', sans-serif;
            text-transform: uppercase;
            font-size: 1.1rem;
            margin-bottom: 16px;
            color: var(--brand-teal);
            letter-spacing: 0.05em;
        }

        .form-group {
            margin-bottom: 24px;
        }

        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input, textarea, select {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            font-family: inherit;
            font-size: 1rem;
            color: var(--text-primary);
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--brand-teal);
            box-shadow: 0 0 0 3px rgba(31, 138, 112, 0.1);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        button {
            padding: 12px 32px;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .btn-primary {
            background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
            color: white;
            width: 100%;
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(31, 138, 112, 0.3);
        }

        .btn-primary:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }

        .btn-secondary {
            background: white;
            color: var(--text-primary);
            border: 2px solid var(--border-light);
        }

        .btn-secondary:hover {
            background: var(--bg-light);
        }

        .status-message {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-weight: 500;
            border: 1px solid transparent;
        }

        .status-error {
            background: #fee2e2;
            color: #7f1d1d;
            border-color: #fecaca;
        }

        .status-success {
            background: #d1fae5;
            color: #065f46;
            border-color: #a7f3d0;
        }

        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-left: 8px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .hidden { display: none; }
    </style>
</head>
<body>

    <div class="form-container">
        
        <!-- HEADER -->
        <div class="form-header">
            <h1>Entrega de Mensaje</h1>
            <p>${eventName}</p>
        </div>

        ${eventError ? \`
            <div class="status-message status-error">
                <strong>Error:</strong> \${eventError}
            </div>
        \` : ''}

        <form id="submission-form" class="\${eventError ? 'hidden' : ''}">
            
            <!-- SECTION 1: SESSION -->
            <div class="form-section">
                <h3>Información de la Sesión</h3>
                
                <div class="form-group">
                    <label for="segment-select">
                        Selecciona tu Plenaria <span style="color: #dc2626;">*</span>
                    </label>
                    <select id="segment-select" required>
                        <option value="" disabled selected>Selecciona una opción...</option>
                        ${options.map(opt => `<option value="${opt.id}">${opt.session_name} • ${opt.speaker}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- SECTION 2: CONTENT -->
            <div class="form-section">
                <h3>Contenido del Mensaje</h3>

                <div class="form-group">
                    <label for="content-area">
                        Notas o Bosquejo <span style="color: #dc2626;">*</span>
                    </label>
                    <textarea id="content-area" required placeholder="Pega aquí tus notas. El sistema extraerá automáticamente los versículos bíblicos."></textarea>
                </div>
            </div>

            <!-- BUTTONS -->
            <button type="submit" id="submit-btn" class="btn-primary">
                <span id="btn-text">Enviar Mensaje</span>
                <span id="btn-loader" class="spinner hidden"></span>
            </button>
        </form>

        <!-- SUCCESS VIEW -->
        <div id="success-view" class="hidden text-center" style="padding: 40px 0;">
            <div style="width: 80px; height: 80px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: #059669;"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h2 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 16px;">¡Mensaje Recibido!</h2>
            <p style="color: var(--text-secondary); margin-bottom: 32px; max-width: 400px; margin-left: auto; margin-right: auto;">
                Gracias por enviar tu contenido. El equipo de producción procesará las referencias bíblicas automáticamente.
            </p>
            <button onclick="window.location.reload()" class="btn-secondary">
                Enviar otro mensaje
            </button>
        </div>

    </div>

    <script>
        const form = document.getElementById('submission-form');
        const submitBtn = document.getElementById('submit-btn');
        const btnText = document.getElementById('btn-text');
        const btnLoader = document.getElementById('btn-loader');
        const successView = document.getElementById('success-view');
        const contentArea = document.getElementById('content-area');
        const segmentSelect = document.getElementById('segment-select');
        
        let idempotencyKey = crypto.randomUUID();

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            submitBtn.disabled = true;
            btnText.textContent = "ENVIANDO...";
            btnLoader.classList.remove('hidden');

            const segmentId = segmentSelect.value;
            const content = contentArea.value;

            try {
                const response = await fetch('/api/functions/submitSpeakerContent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        segment_id: segmentId,
                        content: content,
                        idempotencyKey: idempotencyKey
                    })
                });

                if (response.ok) {
                    form.classList.add('hidden');
                    successView.classList.remove('hidden');
                } else {
                    const errorData = await response.json();
                    alert("Error: " + (errorData.error || "Error desconocido al enviar."));
                    submitBtn.disabled = false;
                    btnText.textContent = "ENVIAR MENSAJE";
                    btnLoader.classList.add('hidden');
                }
            } catch (error) {
                console.error("Submission error:", error);
                alert("Error de conexión. Por favor verifica tu internet e intenta nuevamente.");
                submitBtn.disabled = false;
                btnText.textContent = "ENVIAR MENSAJE";
                btnLoader.classList.add('hidden');
            }
        };
    </script>
</body>
</html>
        `;

        return new Response(html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        return new Response("<h1>Error Interno</h1><p>" + error.message + "</p>", { 
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});