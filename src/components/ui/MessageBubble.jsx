import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, User } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FunctionDisplay = ({ toolCall }) => {
    const [expanded, setExpanded] = useState(false);
    const name = toolCall?.name || 'Function';
    const status = toolCall?.status || 'pending';
    const results = toolCall?.results;
    
    const parsedResults = (() => {
        if (!results) return null;
        try {
            return typeof results === 'string' ? JSON.parse(results) : results;
        } catch {
            return results;
        }
    })();
    
    const isError = results && (
        (typeof results === 'string' && /error|failed/i.test(results)) ||
        (parsedResults?.success === false)
    );
    
    const statusConfig = {
        pending: { icon: Clock, color: 'text-slate-400', text: 'Pendiente' },
        running: { icon: Loader2, color: 'text-blue-500', text: 'Ejecutando...', spin: true },
        in_progress: { icon: Loader2, color: 'text-blue-500', text: 'Procesando...', spin: true },
        completed: isError ? 
            { icon: AlertCircle, color: 'text-red-500', text: 'Falló' } : 
            { icon: CheckCircle2, color: 'text-green-600', text: 'Completado' },
        success: { icon: CheckCircle2, color: 'text-green-600', text: 'Éxito' },
        failed: { icon: AlertCircle, color: 'text-red-500', text: 'Falló' },
        error: { icon: AlertCircle, color: 'text-red-500', text: 'Error' }
    }[status] || { icon: Zap, color: 'text-slate-500', text: '' };
    
    const Icon = statusConfig.icon;
    const formattedName = name.split('.').reverse()[0].replace(/_/g, ' '); // Simple format
    
    return (
        <div className="mt-2 text-xs font-sans">
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full text-left",
                    "hover:bg-slate-50",
                    expanded ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
                )}
            >
                <Icon className={cn("h-3.5 w-3.5", statusConfig.color, statusConfig.spin && "animate-spin")} />
                <span className="text-slate-700 font-medium capitalize">{formattedName}</span>
                {statusConfig.text && (
                    <span className={cn("text-slate-500 ml-auto", isError && "text-red-600")}>
                        {statusConfig.text}
                    </span>
                )}
            </button>
            
            {expanded && !statusConfig.spin && (
                <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {toolCall.arguments_string && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Parámetros:</div>
                            <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap overflow-x-auto font-mono">
                                {(() => {
                                    try {
                                        return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
                                    } catch {
                                        return toolCall.arguments_string;
                                    }
                                })()}
                            </pre>
                        </div>
                    )}
                    {parsedResults && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Resultado:</div>
                            <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-auto font-mono">
                                {typeof parsedResults === 'object' ? 
                                    JSON.stringify(parsedResults, null, 2) : parsedResults}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    
    return (
        <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pdv-teal to-pdv-green flex items-center justify-center mt-0.5 shrink-0 shadow-sm">
                    <Zap className="h-4 w-4 text-white" />
                </div>
            )}
            <div className={cn("max-w-[85%] lg:max-w-[75%]", isUser && "flex flex-col items-end")}>
                {message.content && (
                    <div className={cn(
                        "rounded-2xl px-5 py-3.5 shadow-sm",
                        isUser ? "bg-slate-800 text-white rounded-br-none" : "bg-white border border-slate-100 rounded-bl-none"
                    )}>
                        {isUser ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        ) : (
                            <ReactMarkdown 
                                className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                components={{
                                    // ... existing markdown components ...
                                    code: ({ inline, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <div className="relative group/code">
                                                <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto my-2 text-xs">
                                                    <code className={className} {...props}>{children}</code>
                                                </pre>
                                            </div>
                                        ) : (
                                            <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                                                {children}
                                            </code>
                                        );
                                    },
                                    p: ({ children }) => <p className="my-2 leading-relaxed text-slate-700">{children}</p>,
                                    ul: ({ children }) => <ul className="my-2 ml-4 list-disc text-slate-700">{children}</ul>,
                                    ol: ({ children }) => <ol className="my-2 ml-4 list-decimal text-slate-700">{children}</ol>,
                                    li: ({ children }) => <li className="my-0.5 pl-1">{children}</li>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold my-2 text-slate-900">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold my-2 text-slate-900">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold my-1 text-slate-800">{children}</h3>,
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-pdv-teal/30 pl-3 my-2 text-slate-600 italic">
                                            {children}
                                        </blockquote>
                                    ),
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
                
                {message.file_urls && message.file_urls.length > 0 && (
                     <div className="mt-2 flex flex-wrap gap-2 justify-end">
                         {message.file_urls.map((url, i) => (
                             <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 w-32 h-24">
                                 <img src={url} alt="Attachment" className="object-cover w-full h-full" />
                             </div>
                         ))}
                     </div>
                )}
                
                {message.tool_calls?.length > 0 && (
                    <div className="space-y-1 mt-2 w-full">
                        {message.tool_calls.map((toolCall, idx) => (
                            <FunctionDisplay key={idx} toolCall={toolCall} />
                        ))}
                    </div>
                )}
            </div>
            {isUser && (
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center mt-0.5 shrink-0">
                    <User className="h-4 w-4 text-slate-500" />
                </div>
            )}
        </div>
    );
}