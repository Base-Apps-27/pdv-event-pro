import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Users as UsersIcon, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Teams() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name'),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list('name'),
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
      setShowDialog(false);
      setEditingTeam(null);
      setSelectedMembers([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
      setShowDialog(false);
      setEditingTeam(null);
      setSelectedMembers([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamMember.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamMembers']);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id) => base44.entities.TeamMember.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamMembers']);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      type: formData.get('type'),
      leader_id: formData.get('leader_id') || null,
      notes: formData.get('notes'),
    };

    if (editingTeam) {
      await updateMutation.mutateAsync({ id: editingTeam.id, data });
      
      const existingMembers = teamMembers.filter(tm => tm.team_id === editingTeam.id);
      const existingMemberIds = existingMembers.map(tm => tm.person_id);
      
      const toAdd = selectedMembers.filter(id => !existingMemberIds.includes(id));
      const toRemove = existingMembers.filter(tm => !selectedMembers.includes(tm.person_id));
      
      for (const personId of toAdd) {
        await addMemberMutation.mutateAsync({ team_id: editingTeam.id, person_id: personId });
      }
      
      for (const tm of toRemove) {
        await removeMemberMutation.mutateAsync(tm.id);
      }
    } else {
      const team = await createMutation.mutateAsync(data);
      for (const personId of selectedMembers) {
        await addMemberMutation.mutateAsync({ team_id: team.id, person_id: personId });
      }
    }
  };

  const openEditDialog = (team) => {
    setEditingTeam(team);
    const members = teamMembers.filter(tm => tm.team_id === team.id).map(tm => tm.person_id);
    setSelectedMembers(members);
    setShowDialog(true);
  };

  const getTeamMembers = (teamId) => {
    return teamMembers
      .filter(tm => tm.team_id === teamId)
      .map(tm => people.find(p => p.id === tm.person_id))
      .filter(Boolean);
  };

  const teamTypeColors = {
    WorshipBand: "bg-purple-900 bg-opacity-30 text-purple-400 border-purple-700",
    Projection: "bg-blue-900 bg-opacity-30 text-blue-400 border-blue-700",
    Sound: "bg-green-900 bg-opacity-30 text-green-400 border-green-700",
    Translation: "bg-yellow-900 bg-opacity-30 text-yellow-400 border-yellow-700",
    Photography: "bg-pink-900 bg-opacity-30 text-pink-400 border-pink-700",
    Ushers: "bg-orange-900 bg-opacity-30 text-orange-400 border-orange-700",
    Kids: "bg-cyan-900 bg-opacity-30 text-cyan-400 border-cyan-700",
    Other: "bg-slate-800 text-slate-400 border-slate-700"
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Equipos</h1>
          <p className="text-slate-400 mt-1">Gestiona equipos y sus miembros</p>
        </div>
        <Button onClick={() => { setEditingTeam(null); setSelectedMembers([]); setShowDialog(true); }} className="gradient-pdv text-white font-bold uppercase">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Equipo
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const members = getTeamMembers(team.id);
          const leader = people.find(p => p.id === team.leader_id);
          
          return (
            <Card key={team.id} className="bg-pdv-card border-slate-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-white mb-2">{team.name}</CardTitle>
                    <Badge className={`${teamTypeColors[team.type]} border text-xs font-bold uppercase`}>
                      {team.type}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(team)}>
                      <Edit className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm('¿Eliminar este equipo?')) {
                        deleteMutation.mutate(team.id);
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {leader && (
                  <div className="text-sm">
                    <span className="text-pdv-green font-semibold">Líder:</span>
                    <span className="text-slate-300 ml-2">{leader.name}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-slate-500">Miembros: {members.length}</span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {members.slice(0, 5).map((member) => (
                      <Badge key={member.id} variant="outline" className="text-xs border-slate-700 text-slate-400">
                        {member.name}
                      </Badge>
                    ))}
                    {members.length > 5 && (
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                        +{members.length - 5} más
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-pdv-card border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Nombre del Equipo *</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingTeam?.name}
                required 
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-slate-300">Tipo *</Label>
              <Select name="type" defaultValue={editingTeam?.type || 'Other'}>
                <SelectTrigger className="bg-pdv-charcoal border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WorshipBand">Worship Band</SelectItem>
                  <SelectItem value="Projection">Proyección</SelectItem>
                  <SelectItem value="Sound">Sonido</SelectItem>
                  <SelectItem value="Translation">Traducción</SelectItem>
                  <SelectItem value="Photography">Fotografía</SelectItem>
                  <SelectItem value="Ushers">Ujieres</SelectItem>
                  <SelectItem value="Kids">Niños</SelectItem>
                  <SelectItem value="Other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leader_id" className="text-slate-300">Líder</Label>
              <Select name="leader_id" defaultValue={editingTeam?.leader_id || ''}>
                <SelectTrigger className="bg-pdv-charcoal border-slate-700 text-white">
                  <SelectValue placeholder="Seleccionar líder..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin líder</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Miembros del Equipo</Label>
              <div className="border border-slate-700 rounded p-3 bg-pdv-charcoal max-h-48 overflow-y-auto">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <span className="text-sm text-slate-300">{person.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedMembers.includes(person.id) ? "default" : "outline"}
                      onClick={() => {
                        if (selectedMembers.includes(person.id)) {
                          setSelectedMembers(selectedMembers.filter(id => id !== person.id));
                        } else {
                          setSelectedMembers([...selectedMembers, person.id]);
                        }
                      }}
                      className={selectedMembers.includes(person.id) ? "bg-pdv-green hover:bg-pdv-teal" : "border-slate-700 text-slate-400"}
                    >
                      {selectedMembers.includes(person.id) ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">{selectedMembers.length} miembro(s) seleccionado(s)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Notas</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                defaultValue={editingTeam?.notes}
                rows={3}
                className="bg-pdv-charcoal border-slate-700 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button type="submit" className="gradient-pdv text-white font-bold uppercase">
                {editingTeam ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}