import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { createPageUrl } from "@/utils";
import { hasPermission } from "@/components/utils/permissions";
import { toast } from "sonner";
import { Users, Upload, Loader2, Search, Filter, FileDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SuggestionsManager from "@/components/people/SuggestionsManager";
import { useLanguage } from "@/components/utils/i18n.jsx";

export default function People() {
  const { t } = useLanguage();
  const tealStyle = { backgroundColor: '#1F8A70', color: '#ffffff' };
  
  const [activeTab, setActiveTab] = useState("persons");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // P1-4: Replaced duplicate user fetch with shared hook (2026-02-12)
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes (people change rarely)
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("Subiendo archivo...");

    try {
      // 1. Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setUploadStatus("Analizando datos (esto puede tomar un momento)...");

      // 2. Extract data using the schema
      // We define the target schema to match our Person entity + the source columns logic
      const extractionSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            first_name: { type: "string", description: "Nombre from column 'Nombre'" },
            last_name: { type: "string", description: "Apellido from column 'Apellido'" },
            birth_year: { type: "number", description: "Año de Nacimiento" },
            birth_month_day: { type: "string", description: "Mes - Día de Nacimiento" },
            gender: { type: "string", description: "Género" },
            marital_status: { type: "string", description: "Estado Civil" },
            number_of_children: { type: "number", description: "Numero de Hijos" },
            attended_encounter: { type: "boolean", description: "¿Has asistido a un encuentro?" },
            encounter_date: { type: "string", description: "¿Cuando Asistió al Encuentro?" },
            attended_nueva_vida: { type: "boolean", description: "¿Has asistido a Nueva Vida?" },
            t_shirt_size: { type: "string", description: "Talla de Camiseta" },
            network: { type: "string", description: "¿A que Red Pertenece?" },
            preferred_language: { type: "string", description: "Lenguaje Preferido" },
            email: { type: "string", description: "Email" },
            phone: { type: "string", description: "Teléfono" }
          },
          required: ["first_name", "last_name"]
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === 'success' && Array.isArray(result.output)) {
        setUploadStatus(`Importando ${result.output.length} personas...`);
        
        // 3. Bulk create
        await base44.entities.Person.bulkCreate(result.output);
        
        setUploadStatus("¡Importación completada con éxito!");
        queryClient.invalidateQueries(['people']);
        setTimeout(() => {
          setIsUploadDialogOpen(false);
          setUploading(false);
          setUploadStatus("");
        }, 1500);
      } else {
        setUploadStatus("Error al extraer datos. Asegúrate de usar el formato correcto.");
        setUploading(false);
      }

    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("Error durante la importación: " + error.message);
      setUploading(false);
    }
  };

  const handleRefreshSuggestions = async () => {
    setRefreshing(true);
    try {
      const response = await base44.functions.invoke('refreshSuggestions', {});
      // Phase 1: Replaced alert() with toast (2026-02-11)
      toast.success(`Actualizado: ${response.data.updated} actualizados, ${response.data.deleted} eliminados, ${response.data.unchanged} sin cambios`);
      queryClient.invalidateQueries(['suggestions']);
    } catch (error) {
      toast.error('Error al actualizar sugerencias: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredPeople = people.filter(person => 
    person.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">
            {t('people.title')}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">{t('people.subtitle')}</p>
        </div>
        {activeTab === "persons" && hasPermission(user, 'create_people') && (
          <Button 
            onClick={() => setIsUploadDialogOpen(true)} 
            style={tealStyle}
            className="shadow-md hover:shadow-lg transition-all font-bold uppercase px-6"
          >
            <Upload className="w-5 h-5 mr-2" />
            {t('people.importCsv')}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[600px] grid-cols-2">
          <TabsTrigger value="persons">{t('people.personsTab')}</TabsTrigger>
          <TabsTrigger value="suggestions">{t('people.suggestionsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="persons" className="space-y-6 mt-6">
          <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <Search className="w-5 h-5 text-gray-400" />
            <Input 
              placeholder={t('people.searchPlaceholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0"
            />
            <Badge variant="secondary" className="ml-auto">
              {filteredPeople.length} {t('common.people')}
            </Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('people.network')}</TableHead>
                    <TableHead>{t('people.contact')}</TableHead>
                    <TableHead>{t('people.maritalStatus')}</TableHead>
                    <TableHead>{t('people.encounter')}</TableHead>
                    <TableHead>{t('people.nuevaVida')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     <TableRow>
                       <TableCell colSpan={6} className="h-24 text-center">
                         <div className="flex justify-center items-center text-gray-500">
                           <Loader2 className="w-6 h-6 animate-spin mr-2" /> {t('common.loading')}
                         </div>
                       </TableCell>
                     </TableRow>
                  ) : filteredPeople.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                        {t('people.noResults')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPeople.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-gray-900">{person.first_name} {person.last_name}</span>
                            <span className="text-xs text-gray-500">{person.gender} • {person.birth_year}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {person.network && (
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                              {person.network}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            {person.email && <span className="text-gray-700">{person.email}</span>}
                            {person.phone && <span className="text-gray-500">{person.phone}</span>}
                          </div>
                        </TableCell>
                        <TableCell>{person.marital_status}</TableCell>
                        <TableCell>
                          {person.attended_encounter ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">{t('common.yes')}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.attended_nueva_vida ? (
                             <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">{t('common.yes')}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <div className="mb-4">
            <Button
              onClick={handleRefreshSuggestions}
              disabled={refreshing}
              variant="outline"
              className="bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('people.refreshing') : t('people.refreshSuggestions')}
            </Button>
          </div>
          <SuggestionsManager />
        </TabsContent>
      </Tabs>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('people.importTitle')}</DialogTitle>
            <DialogDescription>
              {t('people.importDesc')}
            </DialogDescription>
          </DialogHeader>
          
          {!uploading ? (
            <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
              <Label htmlFor="file">{t('people.fileLabel')}</Label>
              <Input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
              <p className="text-xs text-gray-500 mt-2">
                {t('people.expectedColumns')}
              </p>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#1F8A70' }} />
              <p className="text-sm font-medium text-gray-600">{uploadStatus}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}