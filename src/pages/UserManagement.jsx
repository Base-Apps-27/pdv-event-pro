import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Search, Shield, Mail, Calendar, Edit2, Plus, Minus } from "lucide-react";
import { getAllPermissionDefinitions } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n";

export default function UserManagement() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [customPermissions, setCustomPermissions] = useState([]);
  const [revokedPermissions, setRevokedPermissions] = useState([]);

  const allPermissions = getAllPermissionDefinitions();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setEditingUser(null);
      setSelectedRole("");
      setCustomPermissions([]);
      setRevokedPermissions([]);
    },
  });

  const handleEditUser = (user) => {
    setEditingUser(user);
    setSelectedRole(user.app_role || 'EventDayViewer');
    setCustomPermissions(user.custom_permissions || []);
    setRevokedPermissions(user.revoked_permissions || []);
  };

  const handleSaveUser = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        data: {
          app_role: selectedRole,
          custom_permissions: customPermissions,
          revoked_permissions: revokedPermissions,
        }
      });
    }
  };

  const toggleCustomPermission = (permKey) => {
    setCustomPermissions(prev => {
      const perms = new Set(prev);
      if (perms.has(permKey)) {
        perms.delete(permKey);
      } else {
        perms.add(permKey);
      }
      return Array.from(perms);
    });
  };

  const toggleRevokedPermission = (permKey) => {
    setRevokedPermissions(prev => {
      const perms = new Set(prev);
      if (perms.has(permKey)) {
        perms.delete(permKey);
      } else {
        perms.add(permKey);
      }
      return Array.from(perms);
    });
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const styles = {
      Admin: "bg-purple-100 text-purple-800 border-purple-300",
      AdmAsst: "bg-blue-100 text-blue-800 border-blue-300",
      EventDayViewer: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return styles[role] || styles.EventDayViewer;
  };

  const getRoleLabel = (role) => {
    const labels = {
      Admin: language === 'es' ? "Super Admin" : "Super Admin",
      AdmAsst: language === 'es' ? "Asistente Admin" : "Assistant Admin",
      EventDayViewer: language === 'es' ? "Visualizador" : "Viewer"
    };
    return labels[role] || (language === 'es' ? "Visualizador" : "Viewer");
  };

  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const categoryLabels = {
    events: { en: 'Events', es: 'Eventos' },
    services: { en: 'Services', es: 'Servicios' },
    resources: { en: 'Resources', es: 'Recursos' },
    settings: { en: 'Settings', es: 'Configuración' },
    live: { en: 'Live View', es: 'Vista en Vivo' },
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            {language === 'es' ? 'Gestión de Usuarios' : 'User Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'es' ? 'Gestiona roles de usuarios y permisos' : 'Manage user roles and permissions'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }}>
          <Users className="w-5 h-5 text-white" />
          <span className="text-white font-bold">
            {users.length} {language === 'es' ? 'Usuarios' : 'Users'}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            {language === 'es' ? 'Buscar Usuarios' : 'Search Users'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder={language === 'es' ? 'Buscar por nombre o email...' : 'Search by name or email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {language === 'es' ? 'Usuario' : 'User'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {language === 'es' ? 'Rol' : 'Role'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {language === 'es' ? 'Permisos' : 'Permissions'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {language === 'es' ? 'Acciones' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      {language === 'es' ? 'Cargando usuarios...' : 'Loading users...'}
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      {language === 'es' ? 'No se encontraron usuarios' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #1F8A70 0%, #4DC15F 100%)' }}>
                            {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="font-semibold text-gray-900">
                            {user.full_name || (language === 'es' ? 'Sin nombre' : 'No name')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={getRoleBadge(user.app_role)}>
                          <Shield className="w-3 h-3 mr-1" />
                          {getRoleLabel(user.app_role)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {user.custom_permissions?.length > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <Plus className="w-3 h-3 mr-1" />
                              {user.custom_permissions.length}
                            </Badge>
                          )}
                          {user.revoked_permissions?.length > 0 && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              <Minus className="w-3 h-3 mr-1" />
                              {user.revoked_permissions.length}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          {language === 'es' ? 'Editar' : 'Edit'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'es' ? 'Editar Usuario' : 'Edit User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {language === 'es' ? 'Usuario' : 'User'}
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #1F8A70 0%, #4DC15F 100%)' }}>
                  {editingUser?.full_name?.charAt(0).toUpperCase() || editingUser?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{editingUser?.full_name || (language === 'es' ? 'Sin nombre' : 'No name')}</div>
                  <div className="text-sm text-gray-500">{editingUser?.email}</div>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {language === 'es' ? 'Rol Base' : 'Base Role'}
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'es' ? 'Selecciona un rol...' : 'Select a role...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>{language === 'es' ? 'Super Admin - Acceso Completo' : 'Super Admin - Full Access'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AdmAsst">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>{language === 'es' ? 'Asistente Admin - Eventos y Servicios' : 'Assistant Admin - Events & Services'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayViewer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>{language === 'es' ? 'Visualizador - Solo Lectura' : 'Viewer - Read-only Access'}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Permissions */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {language === 'es' ? 'Permisos Adicionales' : 'Additional Permissions'}
              </div>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h5 className="text-xs font-bold uppercase text-gray-600 mb-2">
                      {language === 'es' ? categoryLabels[category]?.es : categoryLabels[category]?.en}
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {perms.map(perm => (
                        <div key={perm.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={customPermissions.includes(perm.key)}
                            onCheckedChange={() => toggleCustomPermission(perm.key)}
                          />
                          <label className="text-xs">
                            {language === 'es' ? perm.label_es : perm.label_en}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revoked Permissions */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {language === 'es' ? 'Permisos Revocados' : 'Revoked Permissions'}
              </div>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h5 className="text-xs font-bold uppercase text-gray-600 mb-2">
                      {language === 'es' ? categoryLabels[category]?.es : categoryLabels[category]?.en}
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {perms.map(perm => (
                        <div key={perm.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={revokedPermissions.includes(perm.key)}
                            onCheckedChange={() => toggleRevokedPermission(perm.key)}
                          />
                          <label className="text-xs">
                            {language === 'es' ? perm.label_es : perm.label_en}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending}
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
            >
              {updateUserMutation.isPending ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Cambios' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}