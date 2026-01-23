import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

/**
 * Voice-to-text button using Web Speech API
 * Inserts transcribed text into a textarea
 */
export default function VoiceInputButton({ textareaRef, onTranscriptionComplete }) {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  React.useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.language = language === 'es' ? 'es-ES' : 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setTranscript(prev => prev + transcriptSegment + " ");
          } else {
            interimTranscript += transcriptSegment;
          }
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcript && textareaRef?.current) {
          // Append transcription to textarea
          const currentValue = textareaRef.current.value;
          textareaRef.current.value = currentValue + (currentValue ? " " : "") + transcript;
          // Trigger onChange event for React to update state
          textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
          setTranscript("");
          if (onTranscriptionComplete) {
            onTranscriptionComplete();
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };
    }
  }, [language, textareaRef, onTranscriptionComplete]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      return; // Web Speech API not supported
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  if (!recognitionRef.current) {
    return null; // Don't show button if Web Speech API not supported
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={isListening ? "default" : "outline"}
        onClick={toggleListening}
        className={isListening ? "bg-red-600 hover:bg-red-700 text-white" : ""}
        title={language === 'es' ? 'Micrófono' : 'Microphone'}
      >
        {isListening ? (
          <>
            <Square className="w-4 h-4 mr-1 animate-pulse" />
            {language === 'es' ? 'Escuchando...' : 'Listening...'}
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-1" />
            {language === 'es' ? 'Voz' : 'Voice'}
          </>
        )}
      </Button>
      {isListening && (
        <span className="text-xs text-gray-600 animate-pulse">
          {language === 'es' ? 'Escuchando...' : 'Listening...'}
        </span>
      )}
    </div>
  );
}