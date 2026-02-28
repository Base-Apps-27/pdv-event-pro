/**
 * ArtsTypeOrderEditor.jsx
 * 2026-02-28: Drag-to-reorder the performance sequence of art types within an Artes segment.
 * Used in both the admin editor (ArtesFormSection) and the public form (ArtsSegmentAccordion).
 * 
 * Props:
 *   artTypes - array of selected type strings, e.g. ['DANCE', 'SPOKEN_WORD', 'DRAMA']
 *   artTypeOrder - array of {type, order, label} from entity
 *   onChange - (newOrder: array) => void
 *   language - 'es' | 'en'  (admin editor)  OR  omit for public form (uses its own lang)
 *   isPublicForm - boolean (adjusts styling)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

const TYPE_LABELS = {
  DANCE: { es: '🩰 Danza', en: '🩰 Dance' },
  DRAMA: { es: '🎭 Drama', en: '🎭 Drama' },
  VIDEO: { es: '🎬 Video', en: '🎬 Video' },
  SPOKEN_WORD: { es: '🎤 Spoken Word', en: '🎤 Spoken Word' },
  PAINTING: { es: '🎨 Pintura', en: '🎨 Painting' },
  OTHER: { es: '✨ Otro', en: '✨ Other' },
};

export default function ArtsTypeOrderEditor({ artTypes = [], artTypeOrder = [], onChange, language = 'es', isPublicForm = false }) {
  // Build ordered list: merge existing order with any new types
  const orderedItems = useMemo(() => {
    // Start from saved order, filtered to only currently-selected types
    const existingOrdered = (artTypeOrder || [])
      .filter(item => artTypes.includes(item.type))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const existingTypes = new Set(existingOrdered.map(i => i.type));
    // Append any newly-selected types not yet in the order
    const newItems = artTypes
      .filter(t => !existingTypes.has(t))
      .map((t, idx) => ({
        type: t,
        order: existingOrdered.length + idx + 1,
        label: TYPE_LABELS[t]?.[language] || t,
      }));

    return [...existingOrdered, ...newItems].map((item, idx) => ({
      ...item,
      order: idx + 1,
      label: TYPE_LABELS[item.type]?.[language] || item.type,
    }));
  }, [artTypes, artTypeOrder, language]);

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const items = Array.from(orderedItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    // Re-number
    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    onChange(reordered);
  }, [orderedItems, onChange]);

  if (artTypes.length < 2) return null; // No point showing order for 0-1 types

  const lang = language;

  return (
    <div className={isPublicForm ? 'mt-3' : 'mt-2'}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isPublicForm ? 'text-gray-400' : 'text-gray-500'}`}>
        {lang === 'es' ? '🔢 ORDEN DE PRESENTACIÓN' : '🔢 PERFORMANCE ORDER'}
      </p>
      <p className="text-[11px] text-gray-400 mb-2">
        {lang === 'es' ? 'Arrastra para reordenar la secuencia.' : 'Drag to reorder the sequence.'}
      </p>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="arts-order">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
              {orderedItems.map((item, index) => (
                <Draggable key={item.type} draggableId={item.type} index={index}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      {...prov.dragHandleProps}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        snapshot.isDragging
                          ? 'bg-[#1F8A70]/10 border-[#1F8A70] shadow-md'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                      <span className="font-mono text-xs text-gray-400 w-5 text-center">{index + 1}</span>
                      <span className="flex-1 font-medium text-gray-700">{item.label}</span>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}