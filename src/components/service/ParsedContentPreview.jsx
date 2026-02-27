import React from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ParsedContentPreview({ parsedData, language = 'es' }) {
  if (!parsedData || parsedData.type === 'empty') return null;

  return (
    <div className="space-y-4">
      {/* Key Takeaways (Puntos Clave) */}
      {parsedData.key_takeaways && parsedData.key_takeaways.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h5 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2">
            <span className="text-base">💡</span> {language === 'es' ? 'Puntos Clave' : 'Key Takeaways'}
          </h5>
          <ul className="space-y-1.5">
            {parsedData.key_takeaways.map((point, idx) => (
              <li key={idx} className="flex gap-2 items-start text-amber-900 text-xs">
                <span className="font-bold text-amber-500">•</span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verses List */}
      {parsedData.type === 'verse_list' && parsedData.sections?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-pdv-teal" />
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">{language === 'es' ? 'Versículos' : 'Verses'}</h4>
            <Badge variant="outline" className="text-[10px] py-0">{parsedData.sections.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {parsedData.sections.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-green-50/50 border border-green-100 rounded-md">
                <span className="text-pdv-teal font-bold text-xs">{idx + 1}.</span>
                <span className="text-gray-800 text-xs leading-snug flex-1">{item.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}