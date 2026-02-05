1: import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
   2: 
   3: Deno.serve(async (req) => {
   4:     try {
   5:         const base44 = createClientFromRequest(req);
   6:         const url = new URL(req.url);
   7:         const eventIdParam = url.searchParams.get('event_id');
   8: 
   9:         // --- 1. DATA FETCHING (SSR) ---
  10:         let targetEvent = null;
  11:         let eventError = null;
  12:         let options = [];
  13: 
  14:         try {
  15:             if (eventIdParam) {
  16:                 targetEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
  17:             } else {
  18:                 // Find next upcoming confirmed event
  19:                 const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
  20:                 const today = new Date().toISOString().split('T')[0];
  21:                 const upcoming = events.filter(e => e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  22:                 
  23:                 if (upcoming.length > 0) {
  24:                     targetEvent = upcoming[0];
  25:                 } else {
  26:                     // Fallback to in_progress
  27:                     const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
  28:                     if (progress.length > 0) targetEvent = progress[0];
  29:                 }
  30:             }
  31: 
  32:             if (targetEvent) {
  33:                 // Fetch Sessions
  34:                 const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
  35:                 
  36:                 if (sessions.length > 0) {
  37:                      // Fetch Plenaria Segments (Parallelized)
  38:                     const segmentPromises = sessions.map(sess => 
  39:                         base44.asServiceRole.entities.Segment.filter({ 
  40:                             session_id: sess.id,
  41:                             segment_type: 'Plenaria'
  42:                         })
  43:                     );
  44:                     
  45:                     const segmentsResults = await Promise.all(segmentPromises);
  46:                     const allSegments = segmentsResults.flat();
  47: 
  48:                     // Format Options
  49:                     options = allSegments.map(seg => {
  50:                         const session = sessions.find(s => s.id === seg.session_id);
  51:                         return {
  52:                             id: seg.id,
  53:                             title: seg.title,
  54:                             speaker: seg.presenter || 'TBA',
  55:                             message_title: seg.message_title, // Added as requested
  56:                             time: seg.start_time,
  57:                             date: session?.date,
  58:                             session_name: session?.name,
  59:                             label: `${session?.name || ''} - ${seg.title} (${seg.start_time || 'TBA'})`
  60:                         };
  61:                     });
  62: 
  63:                     // Sort
  64:                     options.sort((a, b) => {
  65:                         const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
  66:                         const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
  67:                         return da - db;
  68:                     });
  69:                 }
  70:             } else {
  71:                 eventError = "No se encontró un evento activo.";
  72:             }
  73: 
  74:         } catch (err) {
  75:             console.error("Data fetching error:", err);
  76:             eventError = "Error cargando datos del evento.";
  77:         }
  78: 
  79:         // --- 2. HTML GENERATION ---
  80:         const eventName = targetEvent ? targetEvent.name : "Evento";
  81:         const eventLocation = targetEvent?.location || "";
  82:         const eventDate = targetEvent?.start_date 
  83:             ? new Date(targetEvent.start_date + "T12:00:00").toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) 
  84:             : "";
  85:         
  86:         // Generate Options HTML with Groups
  87:         let optionsHtml = '';
  88:         let currentGroup = null;
  89: 
  90:         options.forEach(opt => {
  91:             const groupName = opt.session_name || "Otras Sesiones";
  92:             
  93:             // Start new group if needed
  94:             if (groupName !== currentGroup) {
  95:                 if (currentGroup !== null) optionsHtml += '</optgroup>';
  96:                 currentGroup = groupName;
  97:                 optionsHtml += `<optgroup label="${currentGroup}">`;
  98:             }
  99: 
 100:             // Simplified Label: Speaker • "Title" (or Segment Name)
 101:             // Removes the session name redundancy since it's in the group label
 102:             let label = opt.speaker;
 103:             
 104:             if (opt.message_title) {
 105:                 // If we have a specific message title, show it nicely
 106:                 // Check if title is already quoted, if not add quotes for clarity
 107:                 const title = opt.message_title.trim();
 108:                 const isQuoted = title.startsWith('"') || title.startsWith("'");
 109:                 label += ` • ${isQuoted ? title : '"' + title + '"'}`;
 110:             } else {
 111:                 // Fallback to just the segment title (e.g. Plenaria #1)
 112:                 label += ` • ${opt.title}`;
 113:             }
 114: 
 115:             optionsHtml += `<option value="${opt.id}">${label}</option>`;
 116:         });
 117:         
 118:         // Close last group
 119:         if (currentGroup !== null) optionsHtml += '</optgroup>';
 120: 
 121:         const html = `<!DOCTYPE html>
 122: <html lang="es">
 123: <head>
 124:   <meta charset="UTF-8">
 125:   <meta name="viewport" content="width=device-width, initial-scale=1.0">
 126:   <title>Versículos de su Mensaje | ${eventName}</title>
 127:   <meta property="og:title" content="Versículos de su Mensaje | ${eventName}" />
 128:   <meta property="og:description" content="Comparta sus notas o bosquejo para la proyección de versículos." />
 129:   <meta property="og:type" content="website" />
 130:   <link rel="preconnect" href="https://fonts.googleapis.com">
 131:   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 132:   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
 133:   <style>
 134:     /* === CSS VARIABLES === */
 135:     :root {
 136:       --brand-charcoal: #1A1A1A;
 137:       --brand-teal: #1F8A70;
 138:       --brand-green: #8DC63F;
 139:       --brand-yellow: #D7DF23;
 140:       
 141:       --text-primary: #111827;
 142:       --text-secondary: #6B7280;
 143:       --text-tertiary: #9CA3AF;
 144:       --border-light: #E5E7EB;
 145:       --bg-light: #F9FAFB;
 146:       --bg-white: #FFFFFF;
 147:       --bg-gradient-start: #f9fafb;
 148:       --bg-gradient-end: #f3f4f6;
 149:     }
 150: 
 151:     /* === RESET === */
 152:     * { margin: 0; padding: 0; box-sizing: border-box; }
 153: 
 154:     /* === BODY === */
 155:     body {
 156:       font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
 157:       background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
 158:       color: var(--text-primary);
 159:       line-height: 1.6;
 160:       min-height: 100vh;
 161:       padding: 20px;
 162:       display: flex;
 163:       justify-content: center;
 164:       align-items: center;
 165:     }
 166: 
 167:     /* === CONTAINER === */
 168:     .form-container {
 169:       width: 100%;
 170:       max-width: 600px;
 171:       background: var(--bg-white);
 172:       border-radius: 12px;
 173:       box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
 174:       border: 1px solid var(--border-light);
 175:       padding: 0; /* padding moved to inner elements or handled by margins */
 176:       overflow: hidden; /* for gradient bar */
 177:       position: relative;
 178:     }
 179:     
 180:     .container-content {
 181:         padding: 40px 32px 32px 32px;
 182:     }
 183: 
 184:     /* === HEADER === */
 185:     .form-header {
 186:       text-align: center;
 187:       margin-bottom: 40px;
 188:       padding-bottom: 24px;
 189:       border-bottom: 1px solid var(--border-light);
 190:       position: relative;
 191:     }
 192: 
 193:     .form-header h1 {
 194:       font-family: 'Bebas Neue', sans-serif;
 195:       font-size: 3rem;
 196:       color: var(--brand-charcoal);
 197:       letter-spacing: 0.02em;
 198:       margin-bottom: 8px;
 199:       line-height: 1;
 200:     }
 201: 
 202:     .form-header p.org-name {
 203:       font-size: 0.75rem;
 204:       font-weight: 800;
 205:       color: var(--brand-teal);
 206:       text-transform: uppercase;
 207:       letter-spacing: 0.1em;
 208:       margin-bottom: 4px;
 209:     }
 210: 
 211:     .form-header p.event-name {
 212:       font-size: 1.1rem;
 213:       font-weight: 600;
 214:       color: var(--text-secondary);
 215:       text-transform: uppercase;
 216:       letter-spacing: 0.05em;
 217:     }
 218: 
 219:     .form-header .event-meta {
 220:       font-size: 0.85rem;
 221:       color: var(--text-tertiary);
 222:       display: flex;
 223:       justify-content: center;
 224:       flex-wrap: wrap;
 225:       gap: 16px;
 226:       margin-top: 16px;
 227:       font-weight: 500;
 228:     }
 229:     
 230:     .meta-item { display: flex; align-items: center; gap: 6px; }
 231:     .meta-icon { width: 14px; height: 14px; color: var(--brand-green); }
 232:     
 233:     .gradient-bar {
 234:         position: absolute;
 235:         top: 0;
 236:         left: 0;
 237:         right: 0;
 238:         height: 6px;
 239:         background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
 240:     }
 241:     
 242:     .instruction-text {
 243:         font-size: 0.9rem;
 244:         color: var(--text-secondary);
 245:         margin-top: -12px;
 246:         margin-bottom: 24px;
 247:         line-height: 1.4;
 248:     }
 249: 
 250:     /* === STATUS MESSAGES === */
 251:     .status-message {
 252:       padding: 16px;
 253:       border-radius: 8px;
 254:       margin-bottom: 24px;
 255:       font-weight: 500;
 256:       font-size: 0.95rem;
 257:       display: none; /* hidden by default */
 258:       align-items: center;
 259:       gap: 12px;
 260:     }
 261:     
 262:     .status-visible { display: flex; }
 263: 
 264:     .status-success {
 265:       background: #ecfdf5;
 266:       color: #065f46;
 267:       border: 1px solid #a7f3d0;
 268:     }
 269: 
 270:     .status-error {
 271:       background: #fef2f2;
 272:       color: #991b1b;
 273:       border: 1px solid #fecaca;
 274:     }
 275: 
 276:     .status-loading {
 277:       background: #eff6ff;
 278:       color: #1e40af;
 279:       border: 1px solid #bfdbfe;
 280:     }
 281: 
 282:     /* === SECTIONS === */
 283:     .form-section {
 284:       background: var(--bg-light);
 285:       border-radius: 8px;
 286:       border-left: 4px solid var(--brand-teal);
 287:       padding: 24px;
 288:       margin-bottom: 24px;
 289:     }
 290: 
 291:     .form-section h3 {
 292:       font-family: 'Bebas Neue', sans-serif;
 293:       font-size: 1.25rem;
 294:       color: var(--brand-teal);
 295:       margin-bottom: 16px;
 296:       letter-spacing: 0.05em;
 297:     }
 298: 
 299:     /* === FORM ELEMENTS === */
 300:     .form-group { margin-bottom: 16px; }
 301:     
 302:     label {
 303:       display: block;
 304:       font-size: 0.75rem;
 305:       font-weight: 700;
 306:       color: var(--text-secondary);
 307:       text-transform: uppercase;
 308:       letter-spacing: 0.05em;
 309:       margin-bottom: 8px;
 310:     }
 311: 
 312:     .required { color: #dc2626; margin-left: 2px; }
 313: 
 314:     select, textarea {
 315:       width: 100%;
 316:       padding: 12px;
 317:       border: 1px solid var(--border-light);
 318:       border-radius: 6px;
 319:       font-family: inherit;
 320:       font-size: 1rem;
 321:       background: var(--bg-white);
 322:       color: var(--text-primary);
 323:       transition: border-color 0.2s, box-shadow 0.2s;
 324:     }
 325: 
 326:     select:focus, textarea:focus {
 327:       outline: none;
 328:       border-color: var(--brand-teal);
 329:       box-shadow: 0 0 0 3px rgba(31, 138, 112, 0.1);
 330:     }
 331: 
 332:     textarea {
 333:       min-height: 180px;
 334:       resize: vertical;
 335:     }
 336: 
 337:     /* === BUTTON === */
 338:     button {
 339:       width: 100%;
 340:       padding: 16px;
 341:       background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
 342:       color: white;
 343:       font-family: inherit;
 344:       font-weight: 700;
 345:       font-size: 1rem;
 346:       text-transform: uppercase;
 347:       letter-spacing: 0.05em;
 348:       border: none;
 349:       border-radius: 6px;
 350:       cursor: pointer;
 351:       transition: transform 0.1s, box-shadow 0.1s;
 352:     }
 353: 
 354:     button:hover {
 355:       box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
 356:       transform: translateY(-1px);
 357:     }
 358: 
 359:     button:disabled {
 360:       opacity: 0.7;
 361:       cursor: not-allowed;
 362:       transform: none;
 363:     }
 364: 
 365:     /* === SUCCESS STATE === */
 366:     .success-card {
 367:       text-align: center;
 368:       padding: 40px 20px;
 369:     }
 370:     .success-icon {
 371:       width: 64px;
 372:       height: 64px;
 373:       background: #d1fae5;
 374:       color: #059669;
 375:       border-radius: 50%;
 376:       display: flex;
 377:       align-items: center;
 378:       justify-content: center;
 379:       margin: 0 auto 24px;
 380:     }
 381:     .success-icon svg { width: 32px; height: 32px; }
 382:   </style>
 383: </head>
 384: <body>
 385:    <!-- Version: ${new Date().toISOString()} - List Grouping Update -->
 386:    <div class="form-container" id="mainContainer">
 387:     <div class="gradient-bar"></div>
 388:     <div class="container-content">
 389:         ${eventError ? `
 390:             <div class="status-message status-error status-visible">
 391:                 ${eventError}
 392:             </div>
 393:         ` : ''}
 394: 
 395:         <div class="form-header">
 396:           <p class="org-name">PALABRAS DE VIDA</p>
 397:           <h1>VERSÍCULOS DE SU MENSAJE</h1>
 398:           <p class="event-name">${eventName}</p>
 399:           <div class="event-meta">
 400:             ${eventDate ? `
 401:             <div class="meta-item">
 402:                 <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
 403:                   <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 404:                 </svg>
 405:                 <span>${eventDate}</span>
 406:             </div>` : ''}
 407:             ${eventLocation ? `
 408:             <div class="meta-item">
 409:                 <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
 410:                   <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
 411:                   <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
 412:                 </svg>
 413:                 <span>${eventLocation}</span>
 414:             </div>` : ''}
 415:           </div>
 416:         </div>
 417: 
 418:         <div id="statusMessage" class="status-message"></div>
 419: 
 420:         <form id="submissionForm" class="${eventError ? 'hidden' : ''}">
 421:       <!-- Section 1 -->
 422:       <div class="form-section">
 423:         <h3>Información de la Sesión</h3>
 424:         <div class="form-group">
 425:           <label for="segmentId">Seleccione su Plenaria <span class="required">*</span></label>
 426:           <select id="segmentId" required>
 427:             <option value="" disabled selected>Seleccione una opción...</option>
 428:             ${optionsHtml}
 429:           </select>
 430:         </div>
 431:       </div>
 432: 
 433:       <!-- Section 2 -->
 434:       <div class="form-section">
 435:         <h3>Versículos Para Proyección</h3>
 436:         <p class="instruction-text">
 437:             Para proyectar sus textos bíblicos en pantalla, necesitamos identificarlos. Por favor, <strong>pegue aquí sus notas o bosquejo completo</strong>. Nuestro sistema identificará y extraerá automáticamente todos los versículos por usted.
 438:         </p>
 439:         <div class="form-group">
 440:           <label for="content">Pegue sus notas aquí (El sistema detectará los versículos) <span class="required">*</span></label>
 441:           <textarea 
 442:             id="content" 
 443:             placeholder="No es necesario separar los versículos. Puede pegar todo su documento aquí y nosotros haremos el resto." 
 444:             required
 445:           ></textarea>
 446:         </div>
 447:       </div>
 448: 
 449:       <button type="submit" id="submitBtn">Enviar Mensaje</button>
 450:     </form>
 451:   </div>
 452: 
 453:   <!-- Success View (Hidden initially) -->
 454:   <div class="form-container" id="successContainer" style="display: none;">
 455:     <div class="gradient-bar"></div>
 456:     <div class="success-card">
 457:         <div class="success-icon">
 458:             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
 459:               <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
 460:             </svg>
 461:         </div>
 462:         <div class="form-header" style="border: none; padding: 0;">
 463:             <h1>¡Mensaje Recibido!</h1>
 464:             <p style="text-transform: none; color: var(--text-secondary);">
 465:                 Gracias por enviar su contenido. El equipo procesará las referencias automáticamente.
 466:             </p>
 467:         </div>
 468:         <button onclick="window.location.reload()" style="background: white; color: var(--text-primary); border: 1px solid var(--border-light);">
 469:             Enviar otro mensaje
 470:         </button>
 471:     </div>
 472:   </div>
 473: 
 474:   <script>
 475:     const form = document.getElementById('submissionForm');
 476:     const submitBtn = document.getElementById('submitBtn');
 477:     const statusMsg = document.getElementById('statusMessage');
 478:     const mainContainer = document.getElementById('mainContainer');
 479:     const successContainer = document.getElementById('successContainer');
 480:     
 481:     // Generate idempotency key
 482:     const IDEMPOTENCY_KEY = crypto.randomUUID();
 483: 
 484:     form.addEventListener('submit', async (e) => {
 485:         e.preventDefault();
 486:         
 487:         const segmentId = document.getElementById('segmentId').value;
 488:         const content = document.getElementById('content').value;
 489: 
 490:         if (!segmentId || !content.trim()) return;
 491: 
 492:         // Loading State
 493:         submitBtn.disabled = true;
 494:         submitBtn.innerText = 'Enviando...';
 495:         statusMsg.className = 'status-message status-loading status-visible';
 496:         statusMsg.innerText = 'Enviando mensaje...';
 497: 
 498:         try {
 499:             const response = await fetch('/api/functions/submitSpeakerContent', {
 500:                 method: 'POST',
 501:                 headers: { 'Content-Type': 'application/json' },
 502:                 body: JSON.stringify({
 503:                     segment_id: segmentId,
 504:                     content: content,
 505:                     idempotencyKey: IDEMPOTENCY_KEY
 506:                 })
 507:             });
 508: 
 509:             const result = await response.json();
 510: 
 511:             if (!response.ok || result.error) {
 512:                 throw new Error(result.error || 'Error en la solicitud');
 513:             }
 514: 
 515:             // Success - switch views and scroll to top
 516:             if (mainContainer && successContainer) {
 517:                 mainContainer.style.display = 'none';
 518:                 successContainer.style.display = 'block';
 519:                 window.scrollTo(0, 0); // CRITICAL FIX for "blank screen" if user scrolled down
 520:             } else {
 521:                 // Fallback if containers missing
 522:                 alert('Mensaje enviado correctamente.');
 523:                 window.location.reload();
 524:             }
 525: 
 526:         } catch (err) {
 527:             console.error(err);
 528:             statusMsg.className = 'status-message status-error status-visible';
 529:             statusMsg.innerText = err.message || 'Error al enviar. Intente nuevamente.';
 530:             submitBtn.disabled = false;
 531:             submitBtn.innerText = 'ENVIAR MENSAJE';
 532:         }
 533:     });
 534:   </script>
 535: </body>
 536: </html>`;
 537: 
 538:         return new Response(html, {
 539:             headers: { 
 540:                 'Content-Type': 'text/html; charset=utf-8',
 541:                 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
 542:                 'Pragma': 'no-cache',
 543:                 'Expires': '0'
 544:             }
 545:         });
 546: 
 547:     } catch (error) {
 548:         return new Response("<h1>Error Interno</h1><p>" + error.message + "</p>", { 
 549:             status: 500,
 550:             headers: { 'Content-Type': 'text/html; charset=utf-8' }
 551:         });
 552:     }
 553: });