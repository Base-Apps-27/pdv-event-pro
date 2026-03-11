import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Plus, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

/**
 * 2026-03-09: ParsedVerseEditor
 * Direct editor for fixing LLM-extracted verses and takeaways on processed segments.
 * Admins can delete false positives, edit text, add new entries.
 */
export default function ParsedVerseEditor({ open, onOpenChange, segment, onSaved }) {
    const [verses, setVerses] = useState([]);
    const [takeaways, setTakeaways] = useState([]);
    const [editingVerseId, setEditingVerseId] = useState(null);
    const [editingTakeawayId, setEditingTakeawayId] = useState(null);
    const [newVerseText, setNewVerseText] = useState("");
    const [newTakeawayText, setNewTakeawayText] = useState("");

    // Initialize from segment's parsed_verse_data
    useEffect(() => {
        if (open && segment?.parsed_verse_data) {
            const pvd = segment.parsed_verse_data;
            setVerses((pvd.sections || []).map((s, i) => ({ id: i, content: s.content })));
            setTakeaways((pvd.key_takeaways || []).map((t, i) => ({ id: i, content: t })));
        }
    }, [open, segment]);

    // Mutation: save edited parsed_verse_data back to segment
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!segment) throw new Error("Segment not found");

            // Reconstruct parsed_verse_data with edited verses/takeaways
            const updatedPvd = {
                type: segment.parsed_verse_data?.type || 'verses_with_takeaways',
                sections: verses.map(v => ({ content: v.content })),
                key_takeaways: takeaways.map(t => t.content),
                language: segment.parsed_verse_data?.language || 'es'
            };

            // Update segment
            await base44.entities.Segment.update(segment.id, {
                parsed_verse_data: updatedPvd
            });

            return updatedPvd;
        },
        onSuccess: () => {
            toast.success("Contenido actualizado correctamente");
            onOpenChange(false);
            onSaved?.(); // Trigger parent query invalidation
        },
        onError: (error) => {
            toast.error(error.message || "Error al guardar");
        }
    });

    const handleDeleteVerse = (id) => {
        setVerses(verses.filter(v => v.id !== id));
    };

    const handleDeleteTakeaway = (id) => {
        setTakeaways(takeaways.filter(t => t.id !== id));
    };

    const handleAddVerse = () => {
        if (newVerseText.trim()) {
            setVerses([...verses, { id: Date.now(), content: newVerseText }]);
            setNewVerseText("");
        }
    };

    const handleAddTakeaway = () => {
        if (newTakeawayText.trim()) {
            setTakeaways([...takeaways, { id: Date.now(), content: newTakeawayText }]);
            setNewTakeawayText("");
        }
    };

    const handleEditVerse = (id, newText) => {
        setVerses(verses.map(v => v.id === id ? { ...v, content: newText } : v));
        setEditingVerseId(null);
    };

    /**
     * Scan the original submitted_content for version tokens (NVI, NTV, RVR60, ESV, etc.)
     * sitting right after a chapter:verse pattern, then append them to matching verse rows
     * that don't already have a version. Does NOT touch rows that already have a version,
     * and does NOT alter any other text.
     */
    const handlePatchVersions = () => {
        const raw = segment?.submitted_content;
        if (!raw) return;

        // Same pattern as parseScriptureReferences — captures optional version in group 9
        const versionPattern = /\b(([1-3]\s)?(?:[A-ZÁ-Úa-zá-ú][a-zá-ú]{1,10}\.?))\s+(\d{1,3})[:\s](\d{1,3})(?:[–—-]\d{1,3})?(?:\s+\(?([A-Z]{2,6}[0-9]{0,2})\)?)?/gi;

        // Build a map: "chapter:verse" → version token (first one found per ref)
        const versionMap = new Map();
        for (const m of raw.matchAll(versionPattern)) {
            const version = m[5]; // group 5 = version token
            if (!version) continue;
            const chVerse = `${m[3]}:${m[4]}`;
            if (!versionMap.has(chVerse)) {
                versionMap.set(chVerse, version.toUpperCase());
            }
        }

        if (versionMap.size === 0) return;

        // Append version to each verse row that (a) matches a chVerse in the map
        // and (b) doesn't already contain a version token on that row.
        const versionRegex = /\b[A-Z]{2,6}[0-9]{0,2}\b/; // detect existing version token
        const chVerseExtract = /(\d{1,3}:\d{1,3})/; // pull chapter:verse from row content

        setVerses(prev => prev.map(v => {
            // Skip rows that already have a version token
            if (versionRegex.test(v.content)) return v;
            const cvMatch = v.content.match(chVerseExtract);
            if (!cvMatch) return v;
            const token = versionMap.get(cvMatch[1]);
            if (!token) return v;
            // Append " TOKEN" to both sides of the " | " pipe if present
            const updated = v.content.includes(' | ')
                ? v.content.replace(/(\d[\d\-:]+)(\s*\|)/, `$1 ${token}$2`).replace(/(\d[\d\-:]+)$/, `$1 ${token}`)
                : `${v.content} ${token}`;
            return { ...v, content: updated };
        }));
    };

    const handleEditTakeaway = (id, newText) => {
        setTakeaways(takeaways.map(t => t.id === id ? { ...t, content: newText } : t));
        setEditingTakeawayId(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Editar Contenido Procesado</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 py-2">
                    {/* Verses Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-amber-800 text-sm uppercase tracking-wide">
                                Versículos ({verses.length})
                            </h3>
                            {segment?.submitted_content && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePatchVersions}
                                    className="text-xs h-7 gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                    title="Rescatar versiones bíblicas del texto original (NVI, NTV, etc.)"
                                >
                                    <Wand2 className="w-3 h-3" />
                                    Rescatar versiones
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {verses.map((verse) => (
                                <div key={verse.id} className="flex gap-2 items-start bg-amber-50 p-3 rounded border border-amber-100">
                                    {editingVerseId === verse.id ? (
                                        <>
                                            <Textarea
                                                value={verse.content}
                                                onChange={(e) => {
                                                    const updated = verses.map(v => v.id === verse.id ? { ...v, content: e.target.value } : v);
                                                    setVerses(updated);
                                                }}
                                                className="flex-1 text-xs h-20 resize-none"
                                            />
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="outline" onClick={() => handleEditVerse(verse.id, verse.content)}>
                                                    ✓
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setEditingVerseId(null)}>
                                                    ✕
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="flex-1 text-xs text-amber-700">{verse.content}</p>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditingVerseId(verse.id)}
                                                className="text-amber-600 hover:text-amber-800 h-7 px-2"
                                            >
                                                Ed
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteVerse(verse.id)}
                                                className="text-red-500 hover:text-red-700 h-7 px-2"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Verse */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nuevo versículo..."
                                value={newVerseText}
                                onChange={(e) => setNewVerseText(e.target.value)}
                                className="text-xs"
                            />
                            <Button size="sm" onClick={handleAddVerse} variant="outline">
                                <Plus className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Takeaways Section */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-teal-800 text-sm uppercase tracking-wide">
                            Puntos Clave ({takeaways.length})
                        </h3>
                        <div className="space-y-2">
                            {takeaways.map((takeaway) => (
                                <div key={takeaway.id} className="flex gap-2 items-start bg-teal-50 p-3 rounded border border-teal-100">
                                    {editingTakeawayId === takeaway.id ? (
                                        <>
                                            <Textarea
                                                value={takeaway.content}
                                                onChange={(e) => {
                                                    const updated = takeaways.map(t => t.id === takeaway.id ? { ...t, content: e.target.value } : t);
                                                    setTakeaways(updated);
                                                }}
                                                className="flex-1 text-xs h-20 resize-none"
                                            />
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="outline" onClick={() => handleEditTakeaway(takeaway.id, takeaway.content)}>
                                                    ✓
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setEditingTakeawayId(null)}>
                                                    ✕
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="flex-1 text-xs text-teal-700">{takeaway.content}</p>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditingTakeawayId(takeaway.id)}
                                                className="text-teal-600 hover:text-teal-800 h-7 px-2"
                                            >
                                                Ed
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteTakeaway(takeaway.id)}
                                                className="text-red-500 hover:text-red-700 h-7 px-2"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Takeaway */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nuevo punto clave..."
                                value={newTakeawayText}
                                onChange={(e) => setNewTakeawayText(e.target.value)}
                                className="text-xs"
                            />
                            <Button size="sm" onClick={handleAddTakeaway} variant="outline">
                                <Plus className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="gap-2 bg-teal-600 hover:bg-teal-700"
                    >
                        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}