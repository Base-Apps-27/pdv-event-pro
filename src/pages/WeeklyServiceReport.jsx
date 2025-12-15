import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Calendar } from "lucide-react";
import WeeklyServiceReport from "@/components/service/WeeklyServiceReport";

export default function WeeklyServiceReportPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const dateFromUrl = urlParams.get('date');
  const [selectedDate, setSelectedDate] = useState(dateFromUrl || new Date().toISOString().split('T')[0]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 print:p-2">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Informe: Servicios Dominicales
          </h1>
          <p className="text-gray-500 mt-1">Visualiza el orden de servicio semanal</p>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Date Selection */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-pdv-teal" />
            <div className="flex-1">
              <Label>Fecha del Domingo</Label>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 max-w-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <WeeklyServiceReport date={selectedDate} />
    </div>
  );
}