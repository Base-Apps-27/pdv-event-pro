import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { List, AlertTriangle, Loader2, Wand2 } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { sanitizeHtml } from "@/components/utils/sanitizeHtml";

// Character limits - different for static vs dynamic
const STATIC_LIMITS = { title: 60, body: 420, cue: 200, date: 50 };
const DYNAMIC_LIMITS = { title: 80, body: 600, cue: 300, date: 50 };

// Rich text editor using contenteditable for real-time formatting display
function RichTextArea({ value, onChange, placeholder, maxLength, rows = 4, id }) {
  const [charCount, setCharCount] = useState(0);
  const editorRef = React.useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Get plain text length from HTML
  const getTextLength = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    return temp.textContent?.length || 0;
  };
  
  useEffect(() => {
    setCharCount(getTextLength(value));
  }, [value]);
  
  // P0-3: Sanitize before assigning to contentEditable innerHTML (2026-02-12)
  // Sync value to editor on mount and when value changes externally
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = sanitizeHtml(value || '');
    }
  }, [value, isFocused]);
  
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > maxLength * 0.85;
  
  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Replace <div> and <br> with proper line breaks for consistency
      const cleaned = html
        .replace(/<div>/gi, '<br>')
        .replace(/<\/div>/gi, '')
        .replace(/^<br>/, '');
      onChange(cleaned);
    }
  };
  
  const applyFormat = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
    handleInput();
  };
  
  const insertBullet = () => {
    document.execCommand('insertText', false, '• ');
    editorRef.current?.focus();
    handleInput();
  };
  
  const minHeight = rows * 24; // Approximate line height
  
  return (
    <div className="space-y-1">
      <div className="flex gap-1 mb-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 font-bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('bold')}
          title="Negrita / Bold"
        >
          B
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat('italic')}
          title="Itálica / Italic"
        >
          I
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertBullet}
          title="Viñeta / Bullet"
        >
          <List className="w-3 h-3 mr-1" />
          •
        </Button>
      </div>
      <div
        ref={editorRef}
        id={id}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        data-placeholder={placeholder}
        style={{ minHeight: `${minHeight}px` }}
        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pdv-teal overflow-auto
          ${isOverLimit ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400
        `}
      />
      <div className={`flex justify-between text-xs ${
        isOverLimit ? 'text-red-600 font-semibold' : isNearLimit ? 'text-amber-600' : 'text-gray-500'
      }`}>
        <span>
          {isOverLimit && <AlertTriangle className="w-3 h-3 inline mr-1" />}
          {charCount} / {maxLength}
        </span>
        {isOverLimit && (
          <span className="text-red-600">
            Excede el límite / Over limit
          </span>
        )}
      </div>
    </div>
  );
}

export default function StaticAnnouncementForm({ 
  announcement, 
  onChange, 
  onSave, 
  onCancel,
  isEditing = false,
  onOptimize,
  optimizing = false
}) {
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  
  const [form, setForm] = useState({
    title: '',
    content: '',
    instructions: '',
    date_label: '',
    date_of_occurrence: '',
    has_video: false,
    is_active: true,
    category: 'General',
    priority: 10,
    emphasize: false,
    ...announcement
  });
  
  const [errors, setErrors] = useState({});
  const isStatic = form.category === 'General';
  const LIMITS = isStatic ? STATIC_LIMITS : DYNAMIC_LIMITS;
  
  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };
  
  const validate = () => {
    const newErrors = {};
    
    // Strip HTML for validation
    const titleLength = (form.title || '').length;
    const bodyLength = (form.content || '').replace(/<[^>]*>/g, '').length;
    const cueLength = (form.instructions || '').replace(/<[^>]*>/g, '').length;
    const dateLength = (form.date_label || '').length;
    
    if (!form.title?.trim()) {
      newErrors.title = 'Título requerido / Title required';
    } else if (isStatic && titleLength > LIMITS.title) {
      newErrors.title = `Máximo ${LIMITS.title} caracteres / Max ${LIMITS.title} characters`;
    }
    
    // Enforce body/cue limits for both types (different limits)
    if (bodyLength > LIMITS.body) {
      newErrors.content = `Máximo ${LIMITS.body} caracteres / Max ${LIMITS.body} characters`;
    }
    
    if (cueLength > LIMITS.cue) {
      newErrors.instructions = `Máximo ${LIMITS.cue} caracteres / Max ${LIMITS.cue} characters`;
    }
    
    if (dateLength > LIMITS.date) {
      newErrors.date_label = `Máximo ${LIMITS.date} caracteres / Max ${LIMITS.date} characters`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = () => {
    if (validate()) {
      onSave(form);
    }
  };
  
  const titleLength = (form.title || '').length;
  const isTitleOverLimit = titleLength > LIMITS.title;
  const isTitleNearLimit = titleLength > LIMITS.title * 0.85;
  const titleLimit = LIMITS.title;
  
  return (
    <div className="space-y-4">
      {/* Helper text with AI optimize button - works for both static and dynamic */}
      <div className={`${isStatic ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`text-xs ${isStatic ? 'text-blue-800' : 'text-amber-800'}`}>
            <strong>{isStatic ? 'Anuncios Fijos / Static Announcements:' : 'Anuncios Dinámicos / Dynamic Announcements:'}</strong>
            <p className="mt-1">
              {isStatic 
                ? 'Los anuncios fijos aparecen cada semana. Manténgalos cortos y use el formato para claridad.'
                : 'Los anuncios dinámicos expiran después de su fecha. Incluya detalles como lugar, boletos, y audiencia.'}
            </p>
            <p className={`mt-1 ${isStatic ? 'text-blue-600' : 'text-amber-600'}`}>
              {isStatic
                ? 'Static announcements appear every week. Keep them short and use formatting for clarity.'
                : 'Dynamic announcements expire after their date. Include details like venue, tickets, and audience.'}
            </p>
          </div>
          {onOptimize && (
            <Button
              type="button"
              size="sm"
              onClick={() => onOptimize(form, (result) => setForm(prev => ({ ...prev, ...result })))}
              disabled={optimizing || (!form.title && !form.content)}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 flex-shrink-0"
            >
              {optimizing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Optimizando...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Optimizar con IA
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Category selector */}
      <div className="space-y-1">
        <Label className="font-semibold">Categoría / Category</Label>
        <select
          className="w-full border rounded-md p-2 text-sm"
          value={form.category}
          onChange={(e) => updateField('category', e.target.value)}
        >
          <option value="General">General (Fijo / Static)</option>
          <option value="Event">Evento / Event</option>
          <option value="Ministry">Ministerio / Ministry</option>
          <option value="Urgent">Urgente / Urgent</option>
        </select>
      </div>
      
      {/* Quick toggles */}
      <div className="flex gap-6 p-3 bg-gray-50 rounded-lg border flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.has_video}
            onCheckedChange={(checked) => updateField('has_video', checked)}
          />
          <Label className="font-semibold text-sm">📹 Video</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.is_active}
            onCheckedChange={(checked) => updateField('is_active', checked)}
          />
          <Label className="font-semibold text-sm">👁️ Visible</Label>
        </div>
        {!isStatic && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.emphasize}
              onCheckedChange={(checked) => updateField('emphasize', checked)}
            />
            <Label className="font-semibold text-sm">⭐ Destacar / Emphasize</Label>
          </div>
        )}
      </div>
      
      {/* Title */}
      <div className="space-y-1">
        <Label htmlFor="title" className="font-semibold">
          Título / Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={form.title || ''}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Título del anuncio / Announcement title"
          className={errors.title || isTitleOverLimit ? 'border-red-500 bg-red-50' : ''}
          maxLength={titleLimit + 10}
          />
          <div className={`flex justify-between text-xs ${
          isTitleOverLimit ? 'text-red-600 font-semibold' : isTitleNearLimit ? 'text-amber-600' : 'text-gray-500'
          }`}>
          <span>{titleLength} / {titleLimit}</span>
          {errors.title && <span className="text-red-600">{errors.title}</span>}
          </div>
      </div>
      
      {/* Date of Occurrence - for dynamic only */}
      {!isStatic && (
        <div className="space-y-1">
          <Label htmlFor="date_of_occurrence" className="font-semibold">
            Fecha de Ocurrencia / Date of Occurrence
          </Label>
          <DatePicker
            value={form.date_of_occurrence || ''}
            onChange={(val) => updateField('date_of_occurrence', val)}
            placeholder="Seleccionar fecha"
          />
          <p className="text-xs text-gray-500">
            El anuncio se mostrará hasta esta fecha / Announcement will show until this date
          </p>
          {!form.date_of_occurrence && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              ⚠ Sin fecha: este anuncio no expirará / Without date: won't expire automatically.
            </p>
          )}
        </div>
      )}
      
      {/* Body */}
      <div className="space-y-1">
        <Label htmlFor="content" className="font-semibold">
          Contenido / Body <span className="text-xs text-gray-500">(máx {LIMITS.body})</span>
        </Label>
        <RichTextArea
          id="content"
          value={form.content || ''}
          onChange={(value) => updateField('content', value)}
          placeholder={isStatic 
            ? "Contenido principal del anuncio / Main announcement content" 
            : "Detalles del evento: lugar, boletos, audiencia / Event details: venue, tickets, audience"
          }
          maxLength={LIMITS.body}
          rows={isStatic ? 5 : 6}
        />
        {errors.content && (
          <span className="text-xs text-red-600">{errors.content}</span>
        )}
      </div>

      {/* CUE (optional) */}
      <div className="space-y-1">
        <Label htmlFor="instructions" className="font-semibold">
          CUE / Instrucciones (Opcional) <span className="text-xs text-gray-500">(máx {LIMITS.cue})</span>
        </Label>
        <RichTextArea
          id="instructions"
          value={form.instructions || ''}
          onChange={(value) => updateField('instructions', value)}
          placeholder="Instrucciones para el presentador / Instructions for presenter"
          maxLength={LIMITS.cue}
          rows={3}
        />
        {errors.instructions && (
          <span className="text-xs text-red-600">{errors.instructions}</span>
        )}
      </div>
      
      {/* Date label (optional) - static only */}
      {isStatic && (
        <div className="space-y-1">
          <Label htmlFor="date_label" className="font-semibold">
            Etiqueta de Fecha (Opcional) / Date Label (Optional)
          </Label>
          <Input
            id="date_label"
            value={form.date_label || ''}
            onChange={(e) => updateField('date_label', e.target.value)}
            placeholder="Ej: Todos los domingos / Every Sunday"
            className={errors.date_label ? 'border-red-500 bg-red-50' : ''}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{(form.date_label || '').length} / {LIMITS.date}</span>
            {errors.date_label && <span className="text-red-600">{errors.date_label}</span>}
          </div>
        </div>
      )}
      
      {/* Priority */}
      <div className="space-y-1">
        <Label htmlFor="priority" className="font-semibold">
          Prioridad / Priority
        </Label>
        <Input
          id="priority"
          type="number"
          value={form.priority || 10}
          onChange={(e) => updateField('priority', parseInt(e.target.value) || 10)}
          className="w-24"
        />
        <p className="text-xs text-gray-500">
          Menor número = aparece primero / Lower number = appears first
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar / Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          style={tealStyle}
          disabled={Object.keys(errors).some(k => errors[k])}
        >
          {isEditing ? 'Guardar / Save' : 'Crear / Create'}
        </Button>
      </div>
    </div>
  );
}