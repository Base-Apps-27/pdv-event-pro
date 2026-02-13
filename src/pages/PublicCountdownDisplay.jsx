1: import React, { useState, useEffect, useMemo } from "react";
   2: import { base44 } from "@/api/base44Client";
   3: import { useQuery } from "@tanstack/react-query";
   4: import CountdownBlock from "@/components/service/CountdownBlock";
   5: import CoordinatorActionsDisplay from "@/components/service/CoordinatorActionsDisplay";
   6: import SegmentTimeline from "@/components/service/SegmentTimeline";
   7: import { useLanguage } from "@/components/utils/i18n";
   8: import { formatTimeToEST, formatDateET } from "@/components/utils/timeFormat";
   9: import { normalizeProgramData } from "@/components/utils/normalizeProgram";
  10: import { normalizeStreamBlocks } from "@/components/utils/normalizeStreamBlocks";
  11: import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  12: import { Button } from "@/components/ui/button";
  13: import { Card } from "@/components/ui/card";
  14: import { Tv, Settings, LogOut, Loader2, Radio } from "lucide-react";
  15: import StandbyScreen from "@/components/service/StandbyScreen";
  16: import StreamCoordinatorView from "@/components/live/StreamCoordinatorView";
  17: import { useClockRef, useClockTick } from "@/components/utils/useClockTick";
  18: 
  19: /**
  20:  * PublicCountdownDisplay
  21:  * 
  22:  * Public-facing TV display for live service status.
  23:  * 
  24:  * Modes:
  25:  * - Standard: Main program only (Room View)
  26:  * - Livestream: Stream program only (Stream View)
  27:  * - Combined: Split screen (Room + Stream)
  28:  */
  29: export default function PublicCountdownDisplay() {
  30:   const { t, language } = useLanguage();
  31:   const [currentTime, setCurrentTime] = useState(new Date());
  32:   
  33:   // Brand gradient style (Hardcoded for reliability)
  34:   const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]";
  35:   const [serviceId, setServiceId] = useState(null);
  36:   const [serviceDate, setServiceDate] = useState(() => {
  37:     const d = new Date();
  38:     const year = d.getFullYear();
  39:     const month = String(d.getMonth() + 1).padStart(2, '0');
  40:     const day = String(d.getDate()).padStart(2, '0');
  41:     return `${year}-${month}-${day}`;
  42:   });
  43: 
  44:   const urlParams = new URLSearchParams(window.location.search);
  45:   const mode = urlParams.get('mode') || 'standard'; // standard, livestream, combined
  46:   
  47:   // Tick every second for countdown display
  48:   useEffect(() => {
  49:     const interval = setInterval(() => {
  50:       const now = new Date();
  51:       setCurrentTime(now);
  52: 
  53:       if (!serviceId) {
  54:         const params = new URLSearchParams(window.location.search);
  55:         if (!params.get('service_id') && !params.get('event_id') && !params.get('date')) {
  56:           const year = now.getFullYear();
  57:           const month = String(now.getMonth() + 1).padStart(2, '0');
  58:           const day = String(now.getDate()).padStart(2, '0');
  59:           const todayStr = `${year}-${month}-${day}`;
  60:           
  61:           setServiceDate(prev => prev !== todayStr ? todayStr : prev);
  62:         }
  63:       }
  64:     }, 1000);
  65:     return () => clearInterval(interval);
  66:   }, [serviceId]);
  67: 
  68:   // URL params
  69:   useEffect(() => {
  70:     const params = new URLSearchParams(window.location.search);
  71:     const svcId = params.get('service_id');
  72:     const evtId = params.get('event_id');
  73:     const dt = params.get('date');
  74:     if (svcId) setServiceId(svcId);
  75:     if (evtId) setServiceId(evtId);
  76:     if (dt) setServiceDate(dt);
  77:   }, []);
  78: 
  79:   // Fetch program data
  80:   const { data: programData, isLoading: isLoadingService } = useQuery({
  81:     queryKey: ['tv-public-data', serviceId, serviceDate],
  82:     queryFn: async () => {
  83:       const payload = {
  84:         date: serviceDate
  85:       };
  86:       
  87:       if (serviceId) {
  88:         payload.eventId = serviceId;
  89:         payload.serviceId = serviceId;
  90:       }
  91: 
  92:       const response = await base44.functions.invoke('getPublicProgramData', payload);
  93:       if (response.status >= 400) return null;
  94:       return response.data;
  95:     },
  96:     refetchInterval: 30000 
  97:   });
  98: 
  99:   // Normalize data
 100:   const normalizedData = useMemo(() => normalizeProgramData(programData), [programData]);
 101:   const service = normalizedData.program;
 102:   const segments = normalizedData.segments;
 103:   // Fetch stream blocks if available in raw response
 104:   const streamBlocks = useMemo(() => 
 105:     normalizeStreamBlocks(programData?.streamBlocks || [], segments), 
 106:     [programData?.streamBlocks, segments]
 107:   );
 108: 
 109:   // Sync date
 110:   useEffect(() => {
 111:     if (service) {
 112:       const rawDate = service.date || service.start_date;
 113:       if (rawDate && rawDate !== serviceDate) {
 114:         setServiceDate(rawDate);
 115:       }
 116:     }
 117:   }, [service, serviceDate]);
 118: 
 119:   // Fetch options
 120:   const { data: availableOptions = { events: [], services: [] } } = useQuery({
 121:     queryKey: ['tv-selector-options-public'],
 122:     queryFn: async () => {
 123:       const response = await base44.functions.invoke('getPublicProgramData', { listOptions: true });
 124:       if (response.status >= 400) return { events: [], services: [] };
 125:       return response.data;
 126:     },
 127:     refetchInterval: 60000
 128:   });
 129: 
 130:   // Time Parser
 131:   const getTimeDate = (timeStr, segmentDate = null) => {
 132:     if (!timeStr) return null;
 133:     const [hours, mins] = timeStr.split(':').map(Number);
 134:     
 135:     let date = new Date(currentTime);
 136:     const targetDateStr = segmentDate || serviceDate;
 137: 
 138:     if (targetDateStr) {
 139:       const [y, m, d] = targetDateStr.split('-').map(Number);
 140:       date = new Date(y, m - 1, d); 
 141:     }
 142:     
 143:     date.setHours(hours, mins, 0, 0);
 144:     return date;
 145:   };
 146: 
 147:   // Segment Logic
 148:   const { currentSegment, nextSegment, preLaunchSegment, upcomingSegments } = useMemo(() => {
 149:     if (!segments || segments.length === 0) {
 150:       return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
 151:     }
 152: 
 153:     const validSegments = segments
 154:       .filter(s => {
 155:         if (s.live_status === 'skipped') return false;
 156:         const hasTime = s.actual_start_time || s.start_time;
 157:         if (!hasTime) return false;
 158:         if (s.segment_type === 'Break' || s.segment_type === 'break') return false;
 159:         return true;
 160:       })
 161:       .map(s => ({
 162:         ...s,
 163:         _effectiveStart: s.actual_start_time || s.start_time,
 164:         _effectiveEnd: s.actual_end_time || s.end_time
 165:       }))
 166:       .sort((a, b) => {
 167:         const tA = getTimeDate(a._effectiveStart);
 168:         const tB = getTimeDate(b._effectiveStart);
 169:         if (!tA && !tB) return 0;
 170:         if (!tA) return 1;
 171:         if (!tB) return -1;
 172:         return tA - tB;
 173:       });
 174: 
 175:     if (validSegments.length === 0) {
 176:       return { currentSegment: null, nextSegment: null, preLaunchSegment: null, upcomingSegments: [] };
 177:     }
 178: 
 179:     const current = validSegments.find(s => {
 180:       const start = getTimeDate(s._effectiveStart, s.date);
 181:       const end = s._effectiveEnd ? getTimeDate(s._effectiveEnd, s.date) : (start ? new Date(start.getTime() + (s.duration_min || 0) * 60000) : null);
 182:       if (s.live_hold_status === 'held') return true;
 183:       return start && end && currentTime >= start && currentTime <= end;
 184:     }) || null;
 185: 
 186:     const next = validSegments.find(s => {
 187:       if (s === current) return false;
 188:       const start = getTimeDate(s._effectiveStart, s.date);
 189:       return start && start > currentTime;
 190:     }) || null;
 191: 
 192:     const upcoming = validSegments.filter(s => {
 193:       if (s === current) return false;
 194:       const start = getTimeDate(s._effectiveStart, s.date);
 195:       return start && start > currentTime;
 196:     }).slice(0, 5) || [];
 197: 
 198:     let preLaunch = null;
 199:     if (!current && next) {
 200:       preLaunch = next;
 201:     } else if (!current && !next && validSegments.length > 0) {
 202:        const first = validSegments[0];
 203:        const firstStart = getTimeDate(first._effectiveStart, first.date);
 204:        if (firstStart && currentTime < firstStart) {
 205:          preLaunch = first;
 206:        }
 207:     }
 208: 
 209:     return { 
 210:       currentSegment: current, 
 211:       nextSegment: next, 
 212:       preLaunchSegment: preLaunch,
 213:       upcomingSegments: upcoming
 214:     };
 215:   }, [segments, currentTime, serviceDate]);
 216: 
 217:   // Selection Switcher
 218:   const handleSelectionChange = (val) => {
 219:     if (!val) return;
 220:     const [type, id] = val.split(':');
 221:     setServiceId(id);
 222:     const newUrl = new URL(window.location);
 223:     if (type === 'event') {
 224:       newUrl.searchParams.set('event_id', id);
 225:       newUrl.searchParams.delete('service_id');
 226:     } else {
 227:       newUrl.searchParams.set('service_id', id);
 228:       newUrl.searchParams.delete('event_id');
 229:     }
 230:     window.history.pushState({}, '', newUrl);
 231:   };
 232: 
 233:   // Render Logic
 234:   if (isLoadingService) {
 235:     return (
 236:       <div className="w-full h-screen bg-slate-50 flex items-center justify-center">
 237:         <Loader2 className="w-12 h-12 text-pdv-teal animate-spin" />
 238:       </div>
 239:     );
 240:   }
 241: 
 242:   if (!service) {
 243:     return (
 244:       <div className="w-full h-screen bg-slate-50 flex items-center justify-center p-4">
 245:         <Card className="w-full max-w-md p-8 border-4 border-slate-200 rounded-3xl shadow-xl">
 246:           <div className="text-center mb-8">
 247:             <div className="w-16 h-16 bg-gradient-to-br from-[#1F8A70] to-[#8DC63F] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
 248:               <Tv className="w-8 h-8" />
 249:             </div>
 250:             <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">TV Display Mode</h1>
 251:             <p className="text-slate-500">Select an active event or service to display</p>
 252:           </div>
 253:           <div className="space-y-4">
 254:             <Select onValueChange={handleSelectionChange}>
 255:               <SelectTrigger className="h-14 text-lg bg-white border-2 border-slate-300">
 256:                 <SelectValue placeholder="Select program..." />
 257:               </SelectTrigger>
 258:               <SelectContent>
 259:                 {/* ... options ... */}
 260:                 {availableOptions.events.map(e => <SelectItem key={e.id} value={`event:${e.id}`}>{e.name} ({formatDateET(e.start_date)})</SelectItem>)}
 261:                 {availableOptions.services.map(s => <SelectItem key={s.id} value={`service:${s.id}`}>{s.name} ({formatDateET(s.date)})</SelectItem>)}
 262:               </SelectContent>
 263:             </Select>
 264:           </div>
 265:         </Card>
 266:       </div>
 267:     );
 268:   }
 269: 
 270:   const allDone = !currentSegment && !nextSegment && !preLaunchSegment;
 271:   
 272:   // If Livestream Mode (Exclusive)
 273:   if (mode === 'livestream') {
 274:     // We need to group stream blocks by session for StreamCoordinatorView
 275:     // But StreamCoordinatorView expects a single session.
 276:     // PublicCountdownDisplay is global. 
 277:     // We'll pick the first session with stream blocks.
 278:     
 279:     // Find session with stream blocks
 280:     const sessions = programData?.sessions || [];
 281:     const sessionWithStream = sessions.find(s => s.has_livestream) || sessions[0];
 282:     
 283:     if (sessionWithStream) {
 284:       return (
 285:         <div className="w-full h-screen bg-slate-900 p-4">
 286:           <StreamCoordinatorView 
 287:             session={sessionWithStream}
 288:             segments={segments.filter(s => s.session_id === sessionWithStream.id)}
 289:             currentUser={null} // Read-only mode
 290:           />
 291:         </div>
 292:       );
 293:     }
 294:     return <div className="text-white text-center p-20">No livestream session found.</div>;
 295:   }
 296: 
 297:   // Combined Mode (Left: Room, Right: Stream)
 298:   // Or Standard Mode
 299:   const isCombined = mode === 'combined';
 300: 
 301:   return (
 302:     <div className="w-full min-h-screen bg-slate-50 p-3 md:p-4 flex flex-col items-center overflow-hidden relative group/ui light">
 303:       {/* Top Gradient */}
 304:       <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23]" />
 305: 
 306:       {/* Header */}
 307:       <div className="w-full flex items-center justify-between px-6 py-4 z-20 relative mb-4">
 308:         {/* ... Controls ... */}
 309:         <div className="flex-shrink-0 w-[300px]"></div>
 310:         <div className="flex-1 text-center px-4 min-w-0">
 311:           <h1 className={`text-3xl md:text-5xl font-black uppercase tracking-tight ${gradientText} drop-shadow-sm leading-tight`}>
 312:             {service.name}
 313:           </h1>
 314:         </div>
 315:         <div className="flex-shrink-0 w-[300px] flex justify-end">
 316:           <div className="text-2xl md:text-4xl text-slate-800 font-mono font-bold tracking-tight bg-white/90 backdrop-blur-md px-5 py-2 rounded-xl border border-slate-200 shadow-sm">
 317:             {formatTimeToEST(currentTime.toTimeString().substring(0, 5))}
 318:           </div>
 319:         </div>
 320:       </div>
 321: 
 322:       <div className="w-full max-w-[1800px] flex flex-col gap-5 items-center z-10 flex-1">
 323:         {allDone ? (
 324:           <StandbyScreen currentTime={currentTime} />
 325:         ) : (
 326:           <>
 327:             {isCombined ? (
 328:               /* COMBINED SPLIT VIEW */
 329:               <div className="grid grid-cols-2 gap-4 w-full h-full min-h-[600px]">
 330:                 {/* Left: Main Room */}
 331:                 <div className="flex flex-col gap-4">
 332:                   <div className="bg-slate-200 text-slate-600 px-4 py-2 rounded-t-xl font-bold uppercase text-sm tracking-widest text-center">In-Room Program</div>
 333:                   {currentSegment ? (
 334:                     <CountdownBlock
 335:                       segment={currentSegment}
 336:                       displayMode="in-progress"
 337:                       currentTime={currentTime}
 338:                       serviceDate={currentSegment?.date || serviceDate}
 339:                       getTimeDate={getTimeDate}
 340:                       className="flex-1"
 341:                     />
 342:                   ) : preLaunchSegment ? (
 343:                     <CountdownBlock
 344:                       segment={preLaunchSegment}
 345:                       displayMode="pre-launch"
 346:                       currentTime={currentTime}
 347:                       serviceDate={preLaunchSegment?.date || serviceDate}
 348:                       getTimeDate={getTimeDate}
 349:                       className="flex-1"
 350:                     />
 351:                   ) : (
 352:                     <div className="flex-1 bg-white rounded-3xl border-4 border-slate-200 flex items-center justify-center">
 353:                       <p className="text-slate-400 italic">No active room segment</p>
 354:                     </div>
 355:                   )}
 356:                   
 357:                   <div className="h-1/3 relative min-h-[200px]">
 358:                     <div className="absolute inset-0">
 359:                        <SegmentTimeline
 360:                         segments={upcomingSegments}
 361:                         getTimeDate={getTimeDate}
 362:                         serviceDate={serviceDate}
 363:                         className="h-full"
 364:                        />
 365:                     </div>
 366:                   </div>
 367:                 </div>
 368: 
 369:                 {/* Right: Stream View */}
 370:                 <div className="flex flex-col gap-4">
 371:                   <div className="bg-slate-800 text-white px-4 py-2 rounded-t-xl font-bold uppercase text-sm tracking-widest text-center flex items-center justify-center gap-2">
 372:                     <Radio className="w-4 h-4 text-red-500 animate-pulse" />
 373:                     Livestream
 374:                   </div>
 375:                   <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-300 bg-gray-100">
 376:                     {/* Reuse StreamCoordinatorView but constrain it */}
 377:                     {(() => {
 378:                       const sess = (programData?.sessions || []).find(s => s.has_livestream) || (programData?.sessions || [])[0];
 379:                       if (sess) {
 380:                         return (
 381:                           <div className="absolute inset-0 transform scale-90 origin-top">
 382:                             <StreamCoordinatorView 
 383:                               session={sess}
 384:                               segments={segments.filter(s => s.session_id === sess.id)}
 385:                               currentUser={null}
 386:                             />
 387:                           </div>
 388:                         );
 389:                       }
 390:                       return <div className="p-10 text-center text-slate-400">No stream session</div>;
 391:                     })()}
 392:                   </div>
 393:                 </div>
 394:               </div>
 395:             ) : (
 396:               /* STANDARD TV LAYOUT (Room Only) */
 397:               <div className="grid grid-cols-5 gap-6 w-full items-stretch min-w-[1000px] flex-1">
 398:                 <div className="col-span-3">
 399:                   {currentSegment ? (
 400:                     <CountdownBlock
 401:                       segment={currentSegment}
 402:                       displayMode="in-progress"
 403:                       currentTime={currentTime}
 404:                       serviceDate={currentSegment?.date || serviceDate}
 405:                       getTimeDate={getTimeDate}
 406:                       className="h-full"
 407:                     />
 408:                   ) : preLaunchSegment ? (
 409:                     <CountdownBlock
 410:                       segment={preLaunchSegment}
 411:                       displayMode="pre-launch"
 412:                       currentTime={currentTime}
 413:                       serviceDate={preLaunchSegment?.date || serviceDate}
 414:                       getTimeDate={getTimeDate}
 415:                       className="h-full"
 416:                     />
 417:                   ) : (
 418:                     <div className="h-full min-h-[400px] bg-white rounded-3xl border-4 border-slate-200 p-8 md:p-10 shadow-lg flex items-center justify-center">
 419:                       <p className="text-slate-400 italic text-lg">{t('live.nothingNow')}</p>
 420:                     </div>
 421:                   )}
 422:                 </div>
 423:                 <div className="col-span-2 relative min-h-0">
 424:                   <div className="absolute inset-0 h-full">
 425:                     {upcomingSegments.length > 0 ? (
 426:                       <SegmentTimeline
 427:                       segments={upcomingSegments}
 428:                       getTimeDate={getTimeDate}
 429:                       serviceDate={serviceDate}
 430:                       className="h-full"
 431:                       />
 432:                     ) : (
 433:                       <div className="h-full bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 p-8 flex items-center justify-center">
 434:                         <p className="text-slate-400 italic font-medium">{t('live.endOfProgram')}</p>
 435:                       </div>
 436:                     )}
 437:                   </div>
 438:                 </div>
 439:               </div>
 440:             )}
 441: 
 442:             {/* Coordinator Actions (Shared) */}
 443:             {(currentSegment || nextSegment) && !isCombined && (
 444:               <CoordinatorActionsDisplay
 445:                 currentSegment={currentSegment}
 446:                 nextSegment={nextSegment}
 447:                 currentTime={currentTime}
 448:                 serviceDate={serviceDate}
 449:               />
 450:             )}
 451:           </>
 452:         )}
 453:       </div>
 454:     </div>
 455:   );
 456: }
 457: