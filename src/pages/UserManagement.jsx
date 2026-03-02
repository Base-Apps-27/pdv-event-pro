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
import { getAllPermissionDefinitions, DEFAULT_ROLE_PERMISSIONS } from "@/components/utils/permissions";
import { useLanguage } from "@/components/utils/i18n.jsx";

export default function UserManagement() {
  const { language, t } = useLanguage();
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

  // Phase 7: Added staleTime to reduce unnecessary refetches
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // P0-2: Added onError toast handler (2026-02-12)
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setEditingUser(null);
      setSelectedRole("");
      setCustomPermissions([]);
      setRevokedPermissions([]);
    },
    onError: (err) => toast.error(t('users.updateError') + ': ' + err.message),
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
      toast.success(t('users.usersUpdated').replace('{count}', userIds.size));
    },
    onError: (err) => {
      toast.error(t('users.bulkUpdateError'));
    }
  });

  const handleEditUser = (user) => {
    setEditingUser(user);
    const role = user.app_role || 'EventDayViewer';
    setSelectedRole(role);
    // Use display_name if set, otherwise fallback to built-in full_name
    setEditingFullName(user.display_name || user.full_name || "");
    setCustomPermissions(user.custom_permissions || []);
    setRevokedPermissions(user.revoked_permissions || []);
  };

  const handleSaveUser = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        data: {
          // Use display_name (editable) instead of built-in full_name (read-only)
          display_name: editingFullName.trim() || null,
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
      LivestreamAdmin: "bg-red-100 text-red-800 border-red-300",
      EventDayCoordinator: "bg-teal-100 text-teal-800 border-teal-300",
      EventDayViewer: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return styles[role] || styles.EventDayViewer;
  };

  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  // CRIT-8 FIX (2026-02-20): Import canonical role→permission map from permissions.jsx.
  // Eliminates local duplicate that drifted (missing AdmAsst chat, EventDayCoordinator, LivestreamAdmin).
  const getRolePermissions = (role) => {
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl text-gray-900 uppercase tracking-tight">
            {t('users.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('users.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }}>
          <Users className="w-5 h-5 text-white" />
          <span className="text-white font-bold">
            {users.length} {t('users.count')}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t('users.search')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder={t('users.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            {/* Bulk Actions */}
            {selectedUserIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Badge className="bg-pdv-teal text-white">
                  {selectedUserIds.size} {t('users.selected')}
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
                  {t('users.changeRole')}
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
                  {t('users.addPermission')}
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
                  {t('users.revokePermission')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  {t('users.clear')}
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
                   {t('users.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                   {t('users.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                   {t('users.permissions')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                   {t('users.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {t('users.loading')}
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {t('users.noResults')}
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
                            {(user.display_name || user.full_name)?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="font-semibold text-gray-900">
                            {user.display_name || user.full_name || t('users.noName')}
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
                          {t(`users.roleBadge.${user.app_role}`) || t('users.roleBadge.EventDayViewer')}
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
                          {t('common.edit')}
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
              {t('users.editUser')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {t('users.user')}
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #1F8A70 0%, #4DC15F 100%)' }}>
                  {editingFullName?.charAt(0).toUpperCase() || editingUser?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={editingFullName}
                    onChange={(e) => setEditingFullName(e.target.value)}
                    placeholder={t('users.displayNamePlaceholder')}
                    className="font-semibold"
                  />
                  <div className="text-sm text-gray-500">{editingUser?.email}</div>
                  <p className="text-xs text-gray-400 italic">
                    {t('users.displayNameHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {t('users.baseRole')}
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>{t('users.superAdmin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AdmAsst">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>{t('users.assistantAdmin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LivestreamAdmin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span>{t('users.livestreamAdmin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayCoordinator">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      <span>{t('users.dayCoordinator')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayViewer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>{t('users.viewer')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* All Permissions (Unified View) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {t('users.permissions')}
              </div>
              <p className="text-xs text-gray-500 mb-2">
                {t('users.permissionsHint')}
              </p>
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h5 className="text-xs font-bold uppercase text-gray-600 mb-2">
                      {t(`category.${category}`)}
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
                                {t('users.role')}
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
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending}
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
            >
              {updateUserMutation.isPending ? t('btn.saving') : t('btn.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "role" && t('users.bulkChangeRole')}
              {bulkAction === "addPerm" && t('users.bulkAddPerm')}
              {bulkAction === "removePerm" && t('users.bulkRevokePerm')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              {t('users.bulkAffect').replace('{count}', selectedUserIds.size)}
            </p>

            {bulkAction === "role" && (
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>{t('users.roleBadge.Admin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AdmAsst">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>{t('users.roleBadge.AdmAsst')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LivestreamAdmin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span>{t('users.roleBadge.LivestreamAdmin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayViewer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>{t('users.roleBadge.EventDayViewer')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayCoordinator">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      <span>{t('users.roleBadge.EventDayCoordinator')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {(bulkAction === "addPerm" || bulkAction === "removePerm") && (
              <Select value={bulkPermission} onValueChange={setBulkPermission}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.selectPermission')} />
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
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleBulkApply}
              disabled={bulkUpdateMutation.isPending || (bulkAction === "role" && !bulkRole) || ((bulkAction === "addPerm" || bulkAction === "removePerm") && !bulkPermission)}
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
            >
              {bulkUpdateMutation.isPending ? t('users.applying') : t('users.applyToAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}