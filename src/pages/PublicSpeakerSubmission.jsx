import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PublicSpeakerSubmission() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const [eventData, setEventData] = useState(null);
  const [options, setOptions] = useState([]);
  
  const [formData, setFormData] = useState({
    segmentId: "",
    content: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Use the backend function to get options
        const response = await base44.functions.invoke("getPublicSpeakerOptions", { event_id: eventId });
        
        if (response.data.error) {
          throw new Error(response.data.error);
        }

        setEventData({
          name: response.data.event_name,
          id: response.data.event_id
        });
        setOptions(response.data.options || []);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("No se pudo cargar la información del evento. Por favor intente más tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.segmentId || !formData.content.trim()) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = crypto.randomUUID();
      
      const response = await base44.functions.invoke("submitSpeakerContent", {
        segment_id: formData.segmentId,
        content: formData.content,
        idempotencyKey
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setSuccess(true);
      toast.success("¡Mensaje enviado correctamente!");
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Error al enviar el mensaje: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold font-['Bebas_Neue'] text-gray-900 mb-2">¡MENSAJE RECIBIDO!</h1>
          <p className="text-gray-600 mb-8">
            Gracias por enviar tu contenido. El equipo procesará las referencias automáticamente.
          </p>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            Enviar otro mensaje
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10 border-b-2 border-teal-600 pb-8">
          <h1 className="text-5xl font-bold font-['Bebas_Neue'] text-gray-900 tracking-tight mb-2">
            ENTREGA DE MENSAJE
          </h1>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            {eventData?.name || 'PALABRAS DE VIDA'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            
            {/* Session Selection */}
            <div className="space-y-4 bg-gray-50 p-6 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-xl font-bold font-['Bebas_Neue'] text-teal-700 tracking-wide">
                INFORMACIÓN DE LA SESIÓN
              </h3>
              <div className="space-y-2">
                <label htmlFor="segment" className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Selecciona tu Plenaria <span className="text-red-500">*</span>
                </label>
                <select
                  id="segment"
                  value={formData.segmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, segmentId: e.target.value }))}
                  className="w-full p-3 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  required
                >
                  <option value="" disabled>Selecciona una opción...</option>
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.session_name} • {opt.speaker} {opt.message_title ? `• ${opt.message_title} ` : ''}({opt.title})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content Input */}
            <div className="space-y-4 bg-gray-50 p-6 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-xl font-bold font-['Bebas_Neue'] text-teal-700 tracking-wide">
                CONTENIDO DEL MENSAJE
              </h3>
              <div className="space-y-2">
                <label htmlFor="content" className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Notas o Bosquejo <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  className="w-full p-4 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-y"
                  placeholder="Pega aquí tus notas. El sistema extraerá automáticamente los versículos bíblicos."
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={submitting}
              className="w-full h-14 bg-gradient-to-r from-teal-600 to-green-500 hover:from-teal-700 hover:to-green-600 text-white font-bold text-lg uppercase tracking-wider shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Mensaje'
              )}
            </Button>

          </form>
        </div>
      </div>
    </div>
  );
}