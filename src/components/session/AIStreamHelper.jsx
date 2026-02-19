/**
 * AIStreamHelper.jsx
 * 
 * AI-assisted StreamBlock builder. Parses a livestream rundown document (PDF/image/text)
 * and proposes StreamBlock records anchored to the session's existing Segments.
 *
 * Flow:
 *  1. Admin uploads a stream rundown doc (or types a description)
 *  2. ExtractDataFromUploadedFile → structured stream cue list
 *  3. InvokeLLM maps cues → proposed StreamBlock records with block_type + anchor_segment_id
 *  4. Admin reviews each block in an interactive proposal list
 *     — can change block_type, anchor segment, title per row before confirming
 *  5. On confirm: bulk create StreamBlock entities
 *
 * Constraint: Segments for the session must already exist (they are the anchor points).
 * If no segments exist, the helper shows a warning instead of the file upload.
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Loader2, CheckCircle2, Undo2, AlertTriangle, Link as LinkIcon, Plus, Radio, PowerOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import AIFileUploadZone from "@/components/event/AIFileUploadZone";

// Block type metadata for display
const BLOCK_TYPES = {
  link: { label: "Link", icon: LinkIcon, color: "bg-blue-100 text-blue-800 border-blue-200", description: "Mirrors a main-program segment on stream" },
  insert: { label: "Insert", icon: Plus, color: "bg-green-100 text-green-800 border-green-200", description: "Stream-only content inserted between segments" },
  replace: { label: "Replace", icon: Radio, color: "bg-orange-100 text-orange-800 border-orange-200", description: "Replaces a main segment with different stream content" },
  offline: { label: "Offline", icon: PowerOff, color: "bg-gray-100 text-gray-800 border-gray-200", description: "Stream goes offline / pre-recorded during this time" },
};

// Compact block type picker for inline editing in the proposal table
function BlockTypePicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {Object.entries(BLOCK_TYPES).map(([type, meta]) => {
        const Icon = meta.icon;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            title={meta.description}
            className={`p-1.5 rounded border transition-all text-xs font-bold uppercase ${
              value === type
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export default function AIStreamHelper({ isOpen, onClose, session, segments, onBlocksCreated }) {
  const [step, setStep] = useState("input"); // "input" | "reviewing" | "success"
  const [attachedFileUrl, setAttachedFileUrl] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [proposedBlocks, setProposedBlocks] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const hasSegments = segments && segments.length > 0;

  const reset = () => {
    setStep("input");
    setAttachedFileUrl(null);
    setUserInput("");
    setProposedBlocks([]);
    setIsProcessing(false);
    setProcessingStep("");
    setIsExecuting(false);
  };

  // ── Step 1: Extract structured data from uploaded file ──
  const extractFileData = async () => {
    if (!attachedFileUrl) return null;
    setProcessingStep("extracting");
    try {
      const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: attachedFileUrl,
        json_schema: {
          type: "object",
          properties: {
            stream_blocks: {
              type: "array",
              description: "Stream/broadcast cues or blocks found in the document, in order",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "What this block is called on-stream" },
                  start_time: { type: "string", description: "Start time HH:MM 24h if visible" },
                  duration_min: { type: "number", description: "Duration in minutes if stated or calculable" },
                  presenter: { type: "string", description: "Host/presenter if listed" },
                  notes: { type: "string", description: "Any production or technical notes" },
                  type_hint: { type: "string", description: "Best guess: live_program, pre_show, insert, offline, graphics_only, interview, promo, transition" }
                }
              }
            }
          }
        }
      });
      if (extraction.status === "success" && extraction.output?.stream_blocks?.length > 0) {
        return extraction.output;
      }
      return null;
    } catch (err) {
      console.warn("[AI_STREAM] ExtractDataFromUploadedFile error:", err.message);
      return null;
    }
  };

  // ── Step 2: Map extracted blocks → StreamBlock proposals using LLM ──
  const analyzeRequest = async () => {
    if (!attachedFileUrl && !userInput.trim()) return;
    setIsProcessing(true);
    setProposedBlocks([]);

    try {
      let extractedData = null;
      if (attachedFileUrl) {
        extractedData = await extractFileData();
      }

      setProcessingStep("analyzing");

      // Build compact segment context for anchoring
      const segmentContext = segments.map(s => ({
        id: s.id,
        order: s.order,
        title: s.title,
        segment_type: s.segment_type,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_min: s.duration_min,
      }));

      const hasExtracted = extractedData?.stream_blocks?.length > 0;
      const fileSection = hasExtracted
        ? `\n## EXTRACTED STREAM CUES\n${JSON.stringify(extractedData.stream_blocks, null, 2)}`
        : attachedFileUrl
          ? `\n## ATTACHED FILE\nAnalyze the file and extract stream blocks from it.`
          : "";

      const userInstruction = userInput.trim()
        ? `"${userInput}"`
        : '"Create stream blocks from the uploaded rundown"';

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a broadcast production assistant mapping a livestream rundown to StreamBlock records.

## SESSION
Name: ${session?.name || "Session"}
Date: ${session?.date || ""}
Start: ${session?.planned_start_time || ""}

## EXISTING SEGMENTS (anchor points available)
${JSON.stringify(segmentContext, null, 2)}
${fileSection}

## USER REQUEST
${userInstruction}

## TASK
Map each stream cue to a StreamBlock record. For each block:
1. Choose block_type:
   - "link" = this block mirrors/broadcasts a main program segment as-is
   - "insert" = stream-only content not in the main program (pre-show, promo, interview)
   - "replace" = stream shows different content instead of the main segment
   - "offline" = stream goes dark / pre-recorded (lunch breaks, transitions not broadcasted)
2. If block_type is "link" or "replace": find the best matching segment_id from EXISTING SEGMENTS by time or title similarity. Set anchor_segment_id to that segment's id, anchor_point to "at_start".
3. If block_type is "insert" or "offline": use anchor_point="absolute" and set absolute_time (HH:MM 24h).
4. Set order sequentially starting at 1.
5. Carry over title, presenter, duration_min, stream_notes from the rundown where available.

## RESPONSE FORMAT (JSON)
{
  "understood": "Brief explanation of what you parsed",
  "blocks": [
    {
      "order": 1,
      "title": "...",
      "block_type": "link|insert|replace|offline",
      "anchor_segment_id": "<segment id or null>",
      "anchor_point": "at_start|before_start|at_end|absolute",
      "absolute_time": "HH:MM or null",
      "offset_min": 0,
      "duration_min": null,
      "presenter": "...",
      "stream_notes": "..."
    }
  ]
}`,
        ...(attachedFileUrl && !hasExtracted ? { file_urls: [attachedFileUrl] } : {}),
        response_json_schema: {
          type: "object",
          properties: {
            understood: { type: "string" },
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  title: { type: "string" },
                  block_type: { type: "string" },
                  anchor_segment_id: { type: "string" },
                  anchor_point: { type: "string" },
                  absolute_time: { type: "string" },
                  offset_min: { type: "number" },
                  duration_min: { type: "number" },
                  presenter: { type: "string" },
                  stream_notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (response?.blocks?.length > 0) {
        // Validate anchor_segment_ids — nullify any that don't exist in segments
        const validSegmentIds = new Set(segments.map(s => s.id));
        const validated = response.blocks.map(b => ({
          ...b,
          anchor_segment_id: validSegmentIds.has(b.anchor_segment_id) ? b.anchor_segment_id : null,
        }));
        setProposedBlocks(validated);
        setStep("reviewing");
      } else {
        toast.error("No se pudieron extraer bloques de stream del documento.");
      }
    } catch (err) {
      console.error("[AI_STREAM] Analysis error:", err);
      toast.error("Error al analizar: " + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  // ── Update a proposed block field inline ──
  const updateBlock = (idx, field, value) => {
    setProposedBlocks(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const removeBlock = (idx) => {
    setProposedBlocks(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Execute: bulk create StreamBlock entities ──
  const handleConfirm = async () => {
    if (!proposedBlocks.length) return;
    setIsExecuting(true);
    try {
      for (const block of proposedBlocks) {
        const { anchor_segment_id, absolute_time, ...rest } = block;
        await base44.entities.StreamBlock.create({
          session_id: session.id,
          ...rest,
          anchor_segment_id: anchor_segment_id || null,
          absolute_time: absolute_time || null,
          offset_min: block.offset_min || 0,
        });
      }
      setStep("success");
      onBlocksCreated?.();
      toast.success(`${proposedBlocks.length} stream blocks creados`);
    } catch (err) {
      console.error("[AI_STREAM] Create error:", err);
      toast.error("Error al crear bloques: " + err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const processingLabel = processingStep === "extracting"
    ? "Extrayendo datos del archivo..."
    : "Analizando rundown...";

  const canSubmit = (userInput.trim() || attachedFileUrl) && !isProcessing;

  return (
    <Dialog open={isOpen} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Asistente IA — Livestream
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session context pill */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg flex-wrap">
            <span className="font-medium">Sesión:</span>
            <Badge variant="outline">{session?.name}</Badge>
            <span className="text-gray-400">•</span>
            <span>{segments.length} segmentos disponibles como puntos de anclaje</span>
          </div>

          {/* Guard: no segments yet */}
          {!hasSegments && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Segmentos requeridos</p>
                  <p className="text-amber-800 text-xs mt-1">
                    Esta sesión aún no tiene segmentos. Define al menos los segmentos principales
                    del programa antes de configurar el stream — el asistente los usará como puntos de anclaje.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ── STEP: INPUT ── */}
          {step === "input" && hasSegments && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Sube el rundown de livestream (PDF, imagen, o texto) y el asistente propondrá los stream blocks
                anclados a los segmentos del programa.
              </p>

              <AIFileUploadZone
                onFileUploaded={(url) => setAttachedFileUrl(url)}
                disabled={isProcessing}
              />

              <Textarea
                placeholder="(Opcional) Instrucciones adicionales o descripción del rundown de stream..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={3}
                className="resize-none"
                disabled={isProcessing}
              />

              <div className="flex justify-end">
                <Button onClick={analyzeRequest} disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700">
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{processingLabel}</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Analizar Rundown</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: REVIEWING ── */}
          {step === "reviewing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {proposedBlocks.length} bloques propuestos — revisa y ajusta antes de crear
                </p>
                <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                  <Undo2 className="w-3.5 h-3.5 mr-1" /> Volver
                </Button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {Object.entries(BLOCK_TYPES).map(([type, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded border ${meta.color}`}>
                      <Icon className="w-3 h-3" /> {meta.label} — {meta.description}
                    </span>
                  );
                })}
              </div>

              <div className="space-y-2">
                {proposedBlocks.map((block, idx) => {
                  const anchoredSegment = segments.find(s => s.id === block.anchor_segment_id);
                  const meta = BLOCK_TYPES[block.block_type] || BLOCK_TYPES.insert;
                  return (
                    <Card key={idx} className="p-3 space-y-2 border-l-4" style={{ borderLeftColor: block.block_type === 'link' ? '#3b82f6' : block.block_type === 'insert' ? '#22c55e' : block.block_type === 'replace' ? '#f97316' : '#9ca3af' }}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-400 mt-1 w-4 shrink-0">{idx + 1}</span>
                        <div className="flex-1 space-y-2">
                          {/* Title + remove */}
                          <div className="flex items-center gap-2">
                            <Input
                              value={block.title}
                              onChange={(e) => updateBlock(idx, 'title', e.target.value)}
                              className="h-8 text-sm font-medium flex-1"
                            />
                            <button onClick={() => removeBlock(idx)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                          </div>

                          {/* Block type selector */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-gray-500">Tipo:</span>
                            <BlockTypePicker value={block.block_type} onChange={(v) => updateBlock(idx, 'block_type', v)} />
                          </div>

                          {/* Anchor segment (for link/replace) */}
                          {(block.block_type === 'link' || block.block_type === 'replace') && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 shrink-0">Ancla:</span>
                              <Select
                                value={block.anchor_segment_id || "__none__"}
                                onValueChange={(v) => updateBlock(idx, 'anchor_segment_id', v === '__none__' ? null : v)}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1">
                                  <SelectValue placeholder="Seleccionar segmento..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sin ancla (flotante)</SelectItem>
                                  {segments.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.order}. {s.title} ({s.start_time})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {anchoredSegment && (
                                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700 shrink-0">
                                  ↔ {anchoredSegment.start_time}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Absolute time (for insert/offline) */}
                          {(block.block_type === 'insert' || block.block_type === 'offline') && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 shrink-0">Hora:</span>
                              <Input
                                type="time"
                                value={block.absolute_time || ""}
                                onChange={(e) => updateBlock(idx, 'absolute_time', e.target.value)}
                                className="h-7 text-xs w-32"
                              />
                              {block.duration_min && (
                                <span className="text-xs text-gray-400">{block.duration_min} min</span>
                              )}
                            </div>
                          )}

                          {/* Presenter (compact) */}
                          {block.presenter && (
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Host:</span> {block.presenter}
                            </div>
                          )}

                          {/* Stream notes (if any) */}
                          {block.stream_notes && (
                            <div className="text-xs text-gray-400 italic truncate">{block.stream_notes}</div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {proposedBlocks.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Todos los bloques fueron eliminados.</p>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1" disabled={isExecuting}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={proposedBlocks.length === 0 || isExecuting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isExecuting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Crear {proposedBlocks.length} Bloques</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === "success" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">¡Bloques Creados!</h3>
                <p className="text-gray-500 text-sm mt-1">Los stream blocks fueron añadidos a la sesión.</p>
              </div>
              <Button onClick={() => { reset(); onClose(); }}>Cerrar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}