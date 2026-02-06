import React, { useState, useRef, useEffect } from "react";
import { Check, X } from "lucide-react";

/**
 * LiveChatEditInput
 * 
 * Inline edit input that replaces the message bubble when editing.
 * Press Enter to save, Escape to cancel.
 * 
 * @param {string} initialText - Current message text
 * @param {Function} onSave - Called with new text when user confirms
 * @param {Function} onCancel - Called when user cancels edit
 */
export default function LiveChatEditInput({ initialText, onSave, onCancel }) {
  const [text, setText] = useState(initialText || "");
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus and select text on mount
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === initialText) {
      onCancel();
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full text-sm px-3 py-2 rounded-xl border-2 border-indigo-300 bg-white text-gray-900 resize-none focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        rows={Math.min(4, Math.max(1, text.split('\n').length))}
        style={{ minHeight: '36px' }}
      />
      <div className="flex items-center gap-1.5 self-end">
        <span className="text-[10px] text-gray-400 mr-1">
          Enter = guardar · Esc = cancelar
        </span>
        <button
          onClick={onCancel}
          className="h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || text.trim() === initialText}
          className="h-6 w-6 rounded-full flex items-center justify-center text-white bg-pdv-teal hover:brightness-110 disabled:opacity-40"
          title="Guardar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}