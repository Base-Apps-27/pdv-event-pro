/**
 * DisplayOverridePanel — Testing controls for forcing specific programs on displays.
 *
 * Generates override URLs with ?override_service_id= or ?override_event_id= params.
 * Displays can check these params and bypass auto-detection for testing.
 *
 * Used on DataFlowMap page for admin testing.
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Tv, Eye, FileText, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function DisplayOverridePanel() {
  const [services, setServices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedType, setSelectedType] = useState("service");
  const [selectedId, setSelectedId] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      const [svcs, evts] = await Promise.all([
        base44.entities.Service.filter({ status: 'active' }, '-date', 20),
        base44.entities.Event.filter({}, '-start_date', 10),
      ]);
      setServices(svcs);
      setEvents(evts);
    };
    load();
  }, []);

  const selectedItem = selectedType === "service" 
    ? services.find(s => s.id === selectedId)
    : events.find(e => e.id === selectedId);

  const displays = [
    { 
      name: "TV Display", 
      icon: Tv, 
      path: "/PublicCountdownDisplay",
      color: "green"
    },
    { 
      name: "Live View", 
      icon: Eye, 
      path: "/PublicProgramView",
      color: "blue"
    },
    { 
      name: "MyProgram", 
      icon: Eye, 
      path: "/MyProgram",
      color: "teal"
    },
    { 
      name: "PDF Generator", 
      icon: FileText, 
      path: "/WeeklyServiceManager",
      color: "purple",
      note: "Uses editor state directly (no override needed)"
    }
  ];

  const generateOverrideUrl = (path) => {
    if (!selectedId) return null;
    const param = selectedType === "service" ? "override_service_id" : "override_event_id";
    const base = window.location.origin;
    return `${base}${path}?${param}=${selectedId}`;
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopiedUrl(""), 2000);
  };

  return (
    <Card className="border-2 border-purple-500">
      <CardHeader className="bg-purple-50">
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-purple-600" />
          Display Override Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="bg-purple-50 border border-purple-300 rounded p-3 text-sm">
          <p className="text-purple-900">
            🧪 Force any service/event to appear on displays for testing. Bypasses auto-detection.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Type</label>
            <Select value={selectedType} onValueChange={(val) => {
              setSelectedType(val);
              setSelectedId("");
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              {selectedType === "service" ? "Service" : "Event"}
            </label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {(selectedType === "service" ? services : events).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.date && `(${item.date})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedItem && (
          <div className="bg-gray-50 border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-600 mb-1">Selected:</p>
            <p className="font-semibold text-sm">{selectedItem.name}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                ID: {selectedItem.id}
              </Badge>
              {selectedItem.date && (
                <Badge variant="outline" className="text-xs">
                  {selectedItem.date}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Override URLs</h4>
          {displays.map((display) => {
            const url = generateOverrideUrl(display.path);
            const Icon = display.icon;
            const isCopied = copiedUrl === url;

            return (
              <div
                key={display.path}
                className={`border-2 rounded p-3 ${
                  display.color === 'green' ? 'border-green-300 bg-green-50' :
                  display.color === 'blue' ? 'border-blue-300 bg-blue-50' :
                  'border-purple-300 bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${
                      display.color === 'green' ? 'text-green-600' :
                      display.color === 'blue' ? 'text-blue-600' :
                      'text-purple-600'
                    }`} />
                    <span className="font-semibold text-sm">{display.name}</span>
                  </div>
                  {url ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyUrl(url)}
                        className="h-7 px-2"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => window.open(url, '_blank')}
                        className={`h-7 px-2 ${
                          display.color === 'green' ? 'bg-green-600 hover:bg-green-700' :
                          display.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                          'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-gray-500">
                      Select a program first
                    </Badge>
                  )}
                </div>
                {display.note && (
                  <p className="text-xs text-gray-600 italic">{display.note}</p>
                )}
                {url && (
                  <code className="text-[10px] text-gray-500 block mt-2 break-all">
                    {url}
                  </code>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-xs">
          <p className="text-yellow-900">
            <strong>Note:</strong> Override params bypass auto-detection. Displays will show the selected program regardless of current date/time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}