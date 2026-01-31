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
import { Users, Search, Shield, Mail, Calendar, Edit2, Plus, Minus, CheckSquare, Square, UserCog } from "lucide-react";
import { toast } from "sonner";
import { getAllPermissionDefinitions } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n";

export default function UserManagement() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [editingFullName, setEditingFullName] = useState("");
  const [customPermissions, setCustomPermissions] = useState([]);
  const [revokedPermissions, setRevokedPermissions] = useState([]);
  
  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState(""); // "role", "addPerm", "removePerm"
  const [bulkRole, setBulkRole] = useState("");
  const [bulkPermission, setBulkPermission] = useState("");

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

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ userIds, updateFn }) => {
      const targetUsers = users.filter(u => userIds.has(u.id));
      const updates = targetUsers.map(user => {
        const data = updateFn(user);
        return base44.entities.User.update(user.id, data);
      });
      return Promise.all(updates);
    },
    onSuccess: (_, { userIds }) => {
      queryClient.invalidateQueries(['users']);
      setSelectedUserIds(new Set());
      setBulkDialogOpen(false);
      setBulkAction("");
      setBulkRole("");
      setBulkPermission("");
      toast.success(
        language === 'es' 
          ? `${userIds.size} usuarios actualizados` 
          : `${userIds.size} users updated`
      );
    },
    onError: (err) => {
      toast.error(language === 'es' ? 'Error al actualizar usuarios' : 'Failed to update users');
    }
  });

  const handleEditUser = (user) => {
    setEditingUser(user);
    const role = user.app_role || 'EventDayViewer';
    setSelectedRole(role);
    setEditingFullName(user.full_name || "");
    setCustomPermissions(user.custom_permissions || []);
    setRevokedPermissions(user.revoked_permissions || []);
  };

  const handleSaveUser = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        data: {
          full_name: editingFullName.trim() || null,
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

  // Bulk selection helpers
  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleBulkApply = () => {
    if (selectedUserIds.size === 0) return;

    let updateFn;
    if (bulkAction === "role" && bulkRole) {
      updateFn = (user) => ({ app_role: bulkRole });
    } else if (bulkAction === "addPerm" && bulkPermission) {
      updateFn = (user) => {
        const existing = new Set(user.custom_permissions || []);
        existing.add(bulkPermission);
        return { custom_permissions: Array.from(existing) };
      };
    } else if (bulkAction === "removePerm" && bulkPermission) {
      updateFn = (user) => {
        const existing = new Set(user.revoked_permissions || []);
        existing.add(bulkPermission);
        return { revoked_permissions: Array.from(existing) };
      };
    } else {
      return;
    }

    bulkUpdateMutation.mutate({ userIds: selectedUserIds, updateFn });
  };

  const getRoleBadge = (role) => {
    const styles = {
      Admin: "bg-purple-100 text-purple-800 border-purple-300",
      AdmAsst: "bg-blue-100 text-blue-800 border-blue-300",
      LiveManager: "bg-indigo-100 text-indigo-800 border-indigo-300",
      EventDayCoordinator: "bg-teal-100 text-teal-800 border-teal-300",
      EventDayViewer: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return styles[role] || styles.EventDayViewer;
  };

  const getRoleLabel = (role) => {
    const labels = {
      Admin: language === 'es' ? "Super Admin" : "Super Admin",
      AdmAsst: language === 'es' ? "Asistente Admin" : "Assistant Admin",
      LiveManager: language === 'es' ? "Gerente en Vivo" : "Live Manager",
      EventDayCoordinator: language === 'es' ? "Coordinador del Día" : "Day Coordinator",
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

  const getRolePermissions = (role) => {
    const defaultPerms = {
      Admin: ['*'],
      AdmAsst: [
        'view_events', 'edit_events', 'create_events',
        'view_services', 'edit_services', 'create_services',
        'view_reports',
        'view_announcements', 'edit_announcements', 'create_announcements',
        'view_people', 'edit_people', 'create_people',
        'view_live_program',
      ],
      EventDayViewer: ['view_live_program'],
    };
    return defaultPerms[role] || [];
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
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder={language === 'es' ? 'Buscar por nombre o email...' : 'Search by name or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            {/* Bulk Actions */}
            {selectedUserIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Badge className="bg-pdv-teal text-white">
                  {selectedUserIds.size} {language === 'es' ? 'seleccionados' : 'selected'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkAction("role");
                    setBulkDialogOpen(true);
                  }}
                  className="gap-1"
                >
                  <UserCog className="w-4 h-4" />
                  {language === 'es' ? 'Cambiar Rol' : 'Change Role'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkAction("addPerm");
                    setBulkDialogOpen(true);
                  }}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'es' ? 'Añadir Permiso' : 'Add Permission'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkAction("removePerm");
                    setBulkDialogOpen(true);
                  }}
                  className="gap-1"
                >
                  <Minus className="w-4 h-4" />
                  {language === 'es' ? 'Revocar Permiso' : 'Revoke Permission'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  {language === 'es' ? 'Limpiar' : 'Clear'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <Checkbox
                      checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
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
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {language === 'es' ? 'Cargando usuarios...' : 'Loading users...'}
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {language === 'es' ? 'No se encontraron usuarios' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${selectedUserIds.has(user.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-4 text-center">
                        <Checkbox
                          checked={selectedUserIds.has(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
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
                  {editingFullName?.charAt(0).toUpperCase() || editingUser?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={editingFullName}
                    onChange={(e) => setEditingFullName(e.target.value)}
                    placeholder={language === 'es' ? 'Nombre completo' : 'Full name'}
                    className="font-semibold"
                  />
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
                  <SelectItem value="EventDayCoordinator">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      <span>{language === 'es' ? 'Coordinador del Día - Programa + Chat' : 'Day Coordinator - Program + Chat'}</span>
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

            {/* All Permissions (Unified View) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {language === 'es' ? 'Permisos' : 'Permissions'}
              </div>
              <p className="text-xs text-gray-500 mb-2">
                {language === 'es' 
                  ? 'Los permisos del rol base están marcados en verde. Añade permisos adicionales o revoca permisos del rol.' 
                  : 'Role base permissions are marked in green. Add extra permissions or revoke role permissions.'}
              </p>
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h5 className="text-xs font-bold uppercase text-gray-600 mb-2">
                      {language === 'es' ? categoryLabels[category]?.es : categoryLabels[category]?.en}
                    </h5>
                    <div className="grid grid-cols-1 gap-2">
                      {perms.map(perm => {
                        const rolePerms = getRolePermissions(selectedRole);
                        const isInRole = rolePerms.includes('*') || rolePerms.includes(perm.key);
                        const isCustomAdded = customPermissions.includes(perm.key);
                        const isRevoked = revokedPermissions.includes(perm.key);
                        const isChecked = (isInRole || isCustomAdded) && !isRevoked;
                        
                        return (
                          <div key={perm.key} className={`flex items-center gap-2 p-2 rounded ${
                            isInRole && !isRevoked ? 'bg-green-50' : ''
                          }`}>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (isInRole) {
                                  // If it's a role permission, toggle revoke
                                  toggleRevokedPermission(perm.key);
                                } else {
                                  // If it's not a role permission, toggle custom add
                                  toggleCustomPermission(perm.key);
                                }
                              }}
                            />
                            <label className="text-xs flex-1">
                              {language === 'es' ? perm.label_es : perm.label_en}
                            </label>
                            {isInRole && !isRevoked && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1 py-0">
                                {language === 'es' ? 'Rol' : 'Role'}
                              </Badge>
                            )}
                            {isCustomAdded && !isInRole && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] px-1 py-0">
                                <Plus className="w-3 h-3" />
                              </Badge>
                            )}
                            {isRevoked && (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px] px-1 py-0">
                                <Minus className="w-3 h-3" />
                              </Badge>
                            )}
                          </div>
                        );
                      })}
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

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "role" && (language === 'es' ? 'Cambiar Rol en Masa' : 'Bulk Change Role')}
              {bulkAction === "addPerm" && (language === 'es' ? 'Añadir Permiso en Masa' : 'Bulk Add Permission')}
              {bulkAction === "removePerm" && (language === 'es' ? 'Revocar Permiso en Masa' : 'Bulk Revoke Permission')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              {language === 'es' 
                ? `Esta acción afectará a ${selectedUserIds.size} usuario(s).`
                : `This action will affect ${selectedUserIds.size} user(s).`}
            </p>

            {bulkAction === "role" && (
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'es' ? 'Selecciona un rol...' : 'Select a role...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Super Admin</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AdmAsst">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>{language === 'es' ? 'Asistente Admin' : 'Assistant Admin'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayViewer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>{language === 'es' ? 'Visualizador' : 'Viewer'}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayCoordinator">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      <span>{language === 'es' ? 'Coordinador del Día' : 'Day Coordinator'}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {(bulkAction === "addPerm" || bulkAction === "removePerm") && (
              <Select value={bulkPermission} onValueChange={setBulkPermission}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'es' ? 'Selecciona un permiso...' : 'Select a permission...'} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {allPermissions.map(perm => (
                    <SelectItem key={perm.key} value={perm.key}>
                      {language === 'es' ? perm.label_es : perm.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleBulkApply}
              disabled={bulkUpdateMutation.isPending || (bulkAction === "role" && !bulkRole) || ((bulkAction === "addPerm" || bulkAction === "removePerm") && !bulkPermission)}
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
            >
              {bulkUpdateMutation.isPending 
                ? (language === 'es' ? 'Aplicando...' : 'Applying...') 
                : (language === 'es' ? 'Aplicar a Todos' : 'Apply to All')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}