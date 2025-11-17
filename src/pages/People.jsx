import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, User, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function People() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const queryClient = useQueryClient();

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Person.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['people']);
      setShowDialog(false);
      setEditingPerson(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Person.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['people']);
      setShowDialog(false);
      setEditingPerson(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Person.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['people']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      default_roles: formData.get('default_roles'),
      notes: formData.get('notes'),
    };

    if (editingPerson) {
      updateMutation.mutate({ id: editingPerson.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Personas</h1>
          <p className="text-slate-400 mt-1">Gestiona el directorio de personas</p>
        </div>
        <Button onClick={() => { setEditingPerson(null); setShowDialog(true); }} className="gradient-pdv text-white font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Persona
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people.map((person) => (
          <Card key={person.id} className="bg-pdv-card border-slate-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pdv-teal bg-opacity-20 flex items-center justify-center">
                    <User className="w-5 h-5 text-pdv-teal" />
                  </div>
                  <CardTitle className="text-lg text-white">{person.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingPerson(person); setShowDialog(true); }}>
                    <Edit className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm('¿Eliminar esta persona?')) {
                      deleteMutation.mutate(person.id);
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {person.email && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span>{person.email}</span>
                </div>
              )}
              {person.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span>{person.phone}</span>
                </div>
              )}
              {person.default_roles && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {person.default_roles.split(',').map((role, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs border-pdv-green text-pdv-green">
                      {role.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-pdv-card border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{editingPerson ? 'Editar Persona' : 'Nueva Persona'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Nombre Completo *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingPerson?.name}
                required 
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input 
                id="email" 
                name="email" 
                type="email"
                defaultValue={editingPerson?.email}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Teléfono</Label>
              <Input 
                id="phone" 
                name="phone" 
                defaultValue={editingPerson?.phone}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_roles" className="text-slate-300">Roles (separados por comas)</Label>
              <Input 
                id="default_roles" 
                name="default_roles" 
                defaultValue={editingPerson?.default_roles}
                placeholder="Speaker, WorshipLeader, MC"
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Notas</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                defaultValue={editingPerson?.notes}
                rows={3}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                {editingPerson ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}