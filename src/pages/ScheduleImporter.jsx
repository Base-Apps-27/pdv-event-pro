import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Paperclip, Sparkles, Image as ImageIcon, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import MessageBubble from "@/components/ui/MessageBubble";
import { useQueryClient } from "@tanstack/react-query";

export default function ScheduleImporter() {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Initialize or fetch conversation
  useEffect(() => {
    const initConversation = async () => {
      try {
        // Check if we have a stored conversation ID or create new
        // For simplicity, creating a new one for this session
        const conv = await base44.agents.createConversation({
          agent_name: "schedule_importer",
          metadata: {
            name: "Schedule Import Session " + new Date().toLocaleDateString(),
          }
        });
        setConversationId(conv.id);
        
        // Add initial greeting if empty
        if (!conv.messages || conv.messages.length === 0) {
            // We can fake a greeting or let the user start
        } else {
            setMessages(conv.messages);
        }
      } catch (error) {
        console.error("Failed to init conversation:", error);
      }
    };
    initConversation();
  }, []);

  // Subscribe to updates
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages);
      setIsLoading(data.status === 'processing');
      // Invalidate queries when agent operations complete to refresh data elsewhere
      if (data.status === 'idle') {
          queryClient.invalidateQueries(['events']);
          queryClient.invalidateQueries(['sessions']);
          queryClient.invalidateQueries(['segments']);
      }
    });

    return () => unsubscribe();
  }, [conversationId, queryClient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || !conversationId) return;

    const content = input;
    const currentFiles = [...files];
    
    setInput("");
    setFiles([]);
    setIsLoading(true);

    try {
      let fileUrls = [];
      
      // Upload files first if any
      if (currentFiles.length > 0) {
        for (const file of currentFiles) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fileUrls.push(file_url);
        }
      }

      await base44.agents.addMessage({
        id: conversationId, // pass the conversation object usually, but ID works in some SDK versions, wait, SDK says pass object
        // Checking SDK docs in prompt: "pass the entire conversation object and the message object"
        // We need the conversation object. Let's fetch it or use a stored one.
        // Actually base44.agents.addMessage(conversation, message)
      }, {
        role: "user",
        content: content,
        file_urls: fileUrls.length > 0 ? fileUrls : undefined
      });
      
      // Note: addMessage in the new SDK might handle ID lookup internally if we pass an object with ID, 
      // but strictly it asks for the conversation object.
      // Let's refine:
      const conversationObj = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conversationObj, {
          role: "user",
          content: content || "Here is the file",
          file_urls: fileUrls.length > 0 ? fileUrls : undefined
      });

    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const gradientStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pdv-teal" />
            Importador Inteligente
          </h1>
          <p className="text-sm text-gray-500">Sube fotos de tus cronogramas antiguos y deja que la IA los digitalice.</p>
        </div>
        <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
                if(confirm("¿Reiniciar conversación?")) {
                    const conv = await base44.agents.createConversation({
                        agent_name: "schedule_importer",
                        metadata: { name: "New Session" }
                    });
                    setConversationId(conv.id);
                    setMessages([]);
                }
            }}
        >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reiniciar
        </Button>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
                <div className="text-center py-12 opacity-50">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">Sube una imagen para comenzar</p>
                </div>
            )}
            
            {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
            ))}
            
            {isLoading && (
                <div className="flex justify-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pdv-teal to-pdv-green flex items-center justify-center mt-0.5 shrink-0 shadow-sm animate-pulse">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-5 py-3.5 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analizando cronograma...
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto">
            {files.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {files.map((file, i) => (
                        <div key={i} className="relative bg-gray-100 border border-gray-200 rounded-lg p-2 flex items-center gap-2 pr-8">
                            <div className="bg-white p-1 rounded border border-gray-200">
                                <ImageIcon className="w-4 h-4 text-blue-500" />
                            </div>
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">{file.name}</span>
                            <button 
                                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full text-gray-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Paperclip className="w-5 h-5 text-gray-500" />
                </Button>
                
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escribe un mensaje o describe el cronograma..."
                    className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-pdv-teal focus-visible:ring-offset-0"
                />
                
                <Button 
                    type="submit" 
                    className="h-12 w-12 shrink-0 rounded-xl text-white shadow-md hover:shadow-lg transition-all"
                    style={gradientStyle}
                    disabled={!input.trim() && files.length === 0}
                >
                    <Send className="w-5 h-5" />
                </Button>
            </form>
        </div>
      </div>
    </div>
  );
}