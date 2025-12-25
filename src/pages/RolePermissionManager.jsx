import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/utils/i18n';
import { getAllPermissionDefinitions } from '@/components/utils/permissions';
import { Shield, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function RolePermissionManager() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const allPermissions = getAllPermissionDefinitions();

  // Group permissions by category
  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const { data: roleTemplates = [] } = useQuery({
    queryKey: ['roleTemplates'],
    queryFn: () => base44.entities.RoleTemplate.list(),
  });

  const createRoleMutation = useMutation({
    mutationFn: (data) => base44.entities.RoleTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
      toast.success(language === 'es' ? 'Rol creado' : 'Role created');
      setIsDialogOpen(false);
      setEditingRole(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RoleTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
      toast.success(language === 'es' ? 'Rol actualizado' : 'Role updated');
      setIsDialogOpen(false);
      setEditingRole(null);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => base44.entities.RoleTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
      toast.success(language === 'es' ? 'Rol eliminado' : 'Role deleted');
    },
  });

  const handleSaveRole = (roleData) => {
    if (editingRole?.id) {
      updateRoleMutation.mutate({ id: editingRole.id, data: roleData });
    } else {
      createRoleMutation.mutate(roleData);
    }
  };

  const categoryLabels = {
    events: { en: 'Events', es: 'Eventos' },
    services: { en: 'Services', es: 'Servicios' },
    resources: { en: 'Resources', es: 'Recursos' },
    settings: { en: 'Settings', es: 'Configuración' },
    live: { en: 'Live View', es: 'Vista en Vivo' },
  };

  return (
    <div className="min-h-screen bg-[#F0F1F3] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 uppercase">
              {language === 'es' ? 'Roles y Permisos' : 'Roles & Permissions'}
            </h1>
            <p className="text-gray-600 mt-1">
              {language === 'es' ? 'Gestiona plantillas de roles y permisos' : 'Manage role templates and permissions'}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingRole({
                    name: '',
                    label_en: '',
                    label_es: '',
                    description_en: '',
                    description_es: '',
                    default_permissions: [],
                    is_system_role: false,
                  });
                }}
                className="gap-2"
                style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: 'white' }}
              >
                <Plus className="w-4 h-4" />
                {language === 'es' ? 'Nuevo Rol' : 'New Role'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRole?.id 
                    ? (language === 'es' ? 'Editar Rol' : 'Edit Role')
                    : (language === 'es' ? 'Crear Rol' : 'Create Role')}
                </DialogTitle>
              </DialogHeader>
              <RoleForm
                role={editingRole}
                onSave={handleSaveRole}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingRole(null);
                }}
                permissionsByCategory={permissionsByCategory}
                categoryLabels={categoryLabels}
                language={language}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {roleTemplates.map((role) => (
            <Card key={role.id} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-pdv-teal" />
                    <div>
                      <CardTitle className="text-xl">
                        {language === 'es' ? role.label_es || role.name : role.label_en || role.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {language === 'es' ? role.description_es : role.description_en}
                      </p>
                      {role.is_system_role && (
                        <Badge variant="outline" className="mt-2">
                          {language === 'es' ? 'Rol del Sistema' : 'System Role'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRole(role);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {!role.is_system_role && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(language === 'es' ? '¿Eliminar este rol?' : 'Delete this role?')) {
                            deleteRoleMutation.mutate(role.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {role.default_permissions?.includes('*') ? (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      {language === 'es' ? '✓ Todos los Permisos' : '✓ All Permissions'}
                    </Badge>
                  ) : (
                    role.default_permissions?.map((permKey) => {
                      const perm = allPermissions.find(p => p.key === permKey);
                      return (
                        <Badge key={permKey} variant="outline" className="text-xs">
                          {perm ? (language === 'es' ? perm.label_es : perm.label_en) : permKey}
                        </Badge>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleForm({ role, onSave, onCancel, permissionsByCategory, categoryLabels, language }) {
  const [formData, setFormData] = useState(role || {
    name: '',
    label_en: '',
    label_es: '',
    description_en: '',
    description_es: '',
    default_permissions: [],
    is_system_role: false,
  });

  const togglePermission = (permKey) => {
    setFormData(prev => {
      const perms = new Set(prev.default_permissions || []);
      if (perms.has(permKey)) {
        perms.delete(permKey);
      } else {
        perms.add(permKey);
      }
      return { ...prev, default_permissions: Array.from(perms) };
    });
  };

  const toggleAllPermissions = () => {
    const allPerms = getAllPermissionDefinitions().map(p => p.key);
    const hasAll = formData.default_permissions?.length === allPerms.length;
    setFormData(prev => ({
      ...prev,
      default_permissions: hasAll ? [] : allPerms,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">{language === 'es' ? 'Nombre (clave)' : 'Name (key)'}</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., CustomRole"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">{language === 'es' ? 'Etiqueta (Inglés)' : 'Label (English)'}</label>
          <Input
            value={formData.label_en}
            onChange={(e) => setFormData({ ...formData, label_en: e.target.value })}
            placeholder="e.g., Custom Role"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">{language === 'es' ? 'Etiqueta (Español)' : 'Label (Spanish)'}</label>
          <Input
            value={formData.label_es}
            onChange={(e) => setFormData({ ...formData, label_es: e.target.value })}
            placeholder="e.g., Rol Personalizado"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">{language === 'es' ? 'Descripción (Inglés)' : 'Description (English)'}</label>
          <Textarea
            value={formData.description_en}
            onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
            placeholder="Role description in English"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">{language === 'es' ? 'Descripción (Español)' : 'Description (Spanish)'}</label>
          <Textarea
            value={formData.description_es}
            onChange={(e) => setFormData({ ...formData, description_es: e.target.value })}
            placeholder="Descripción del rol en español"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-semibold">{language === 'es' ? 'Permisos Predeterminados' : 'Default Permissions'}</label>
          <Button variant="outline" size="sm" onClick={toggleAllPermissions}>
            {formData.default_permissions?.length === getAllPermissionDefinitions().length
              ? (language === 'es' ? 'Deseleccionar Todo' : 'Deselect All')
              : (language === 'es' ? 'Seleccionar Todo' : 'Select All')}
          </Button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
          {Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div key={category}>
              <h4 className="font-semibold text-sm uppercase text-gray-700 mb-2">
                {language === 'es' ? categoryLabels[category]?.es : categoryLabels[category]?.en}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {perms.map(perm => (
                  <div key={perm.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.default_permissions?.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                    <label className="text-sm">
                      {language === 'es' ? perm.label_es : perm.label_en}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          {language === 'es' ? 'Cancelar' : 'Cancel'}
        </Button>
        <Button
          onClick={() => onSave(formData)}
          style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: 'white' }}
        >
          <Save className="w-4 h-4 mr-2" />
          {language === 'es' ? 'Guardar' : 'Save'}
        </Button>
      </div>
    </div>
  );
}