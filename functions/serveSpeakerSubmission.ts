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
                     // Fetch Plenaria Segments
                    let allSegments = [];
                    for (const sess of sessions) {
                         const segs = await base44.asServiceRole.entities.Segment.filter({ 
                             session_id: sess.id,
                             segment_type: 'Plenaria'
                         });
                         allSegments = allSegments.concat(segs);
                    }

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
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .loader {
            border: 3px solid #f3f3f3;
            border-radius: 50%;
            border-top: 3px solid #ffffff;
            width: 20px;
            height: 20px;
            -webkit-animation: spin 1s linear infinite; /* Safari */
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gradient-to-b from-teal-800 to-teal-900 min-h-screen flex items-center justify-center p-4">

    <div id="main-card" class="w-full max-w-2xl bg-white shadow-2xl rounded-xl overflow-hidden">
        
        <!-- Header -->
        <div class="bg-gray-50 border-b p-6">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>
                </div>
                <div>
                    <h1 class="text-xl font-bold text-teal-900">Entrega de Mensaje</h1>
                    <p class="text-sm text-gray-500 font-medium">
                        <span class="text-teal-700 font-bold">${eventName}</span> • Equipo de Producción
                    </p>
                </div>
            </div>
        </div>

        <!-- Content -->
        <div class="p-6 md:p-8">
            
            ${eventError ? `
                <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong class="font-bold">Error:</strong>
                    <span class="block sm:inline">${eventError}</span>
                </div>
            ` : ''}

            <form id="submission-form" class="space-y-6 ${eventError ? 'hidden' : ''}">
                
                <!-- Session Select -->
                <div class="space-y-2">
                    <label class="block text-sm font-bold text-gray-700" for="segment-select">
                        Selecciona tu Sesión
                    </label>
                    <div class="relative">
                        <select id="segment-select" required
                            class="block w-full h-12 pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md bg-white border shadow-sm appearance-none cursor-pointer">
                            <option value="" disabled selected>Selecciona una plenaria...</option>
                            ${options.map(opt => `<option value="${opt.id}">${opt.session_name} • ${opt.speaker}</option>`).join('')}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Text Area -->
                <div class="space-y-2">
                    <label class="block text-sm font-bold text-gray-700" for="content-area">
                        Contenido del Mensaje
                    </label>
                    <p class="text-xs text-gray-500">
                        Pega aquí tus notas o bosquejo. El sistema extraerá automáticamente los versículos bíblicos.
                    </p>
                    <textarea id="content-area" required
                        class="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md p-4 bg-gray-50 focus:bg-white min-h-[300px] font-mono text-gray-800"
                        placeholder="Pega tu mensaje aquí..."></textarea>
                </div>

                <!-- Submit Button -->
                <button type="submit" id="submit-btn"
                    class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all hover:scale-[1.01]">
                    <span id="btn-text">Enviar Mensaje</span>
                    <span id="btn-loader" class="loader ml-2 hidden"></span>
                </button>
            </form>

            <!-- Success State (Hidden by default) -->
            <div id="success-view" class="hidden flex flex-col items-center text-center py-8">
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">¡Mensaje Recibido!</h2>
                <p class="text-gray-600 mb-8 max-w-md mx-auto">
                    Gracias por enviar tu contenido. El equipo de producción procesará las referencias bíblicas automáticamente.
                </p>
                <button onclick="resetForm()"
                    class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                    Enviar otro mensaje
                </button>
            </div>

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
        
        // Generate Idempotency Key
        let idempotencyKey = crypto.randomUUID();

        function resetForm() {
            form.reset();
            successView.classList.add('hidden');
            form.classList.remove('hidden');
            idempotencyKey = crypto.randomUUID(); // New key for new submission
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            // UI Loading State
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            btnText.textContent = "Enviando...";
            btnLoader.classList.remove('hidden');

            const segmentId = segmentSelect.value;
            const content = contentArea.value;

            try {
                // Call Submit Function
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
                    // Success
                    form.classList.add('hidden');
                    successView.classList.remove('hidden');
                } else {
                    const errorData = await response.json();
                    alert("Error: " + (errorData.error || "Error desconocido al enviar."));
                }
            } catch (error) {
                console.error("Submission error:", error);
                alert("Error de conexión. Por favor verifica tu internet e intenta nuevamente.");
            } finally {
                // Reset UI Loading State
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                btnText.textContent = "Enviar Mensaje";
                btnLoader.classList.add('hidden');
            }
        };
    </script>
</body>
</html>
        `;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (error) {
        return new Response("<h1>Error Interno</h1><p>" + error.message + "</p>", { 
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
});