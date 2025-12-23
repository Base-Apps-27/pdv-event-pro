import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Search, Shield, Mail, Calendar, Edit2 } from "lucide-react";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, app_role }) => base44.entities.User.update(userId, { app_role }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setEditingUser(null);
      setSelectedRole("");
    },
  });

  const handleEditRole = (user) => {
    setEditingUser(user);
    setSelectedRole(user.app_role || 'EventDayViewer');
  };

  const handleSaveRole = () => {
    if (editingUser && selectedRole) {
      updateRoleMutation.mutate({ userId: editingUser.id, app_role: selectedRole });
    }
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
      Admin: "Super Admin",
      AdmAsst: "Assistant Admin",
      EventDayViewer: "Viewer"
    };
    return labels[role] || "Viewer";
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            User Management
          </h1>
          <p className="text-gray-500 mt-1">Manage user roles and permissions</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)' }}>
          <Users className="w-5 h-5 text-white" />
          <span className="text-white font-bold">{users.length} Total Users</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by name or email..."
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No users found
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
                            {user.full_name || 'No name'}
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
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {user.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(user)}
                          className="gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Role
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">User</div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #1F8A70 0%, #4DC15F 100%)' }}>
                  {editingUser?.full_name?.charAt(0).toUpperCase() || editingUser?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{editingUser?.full_name || 'No name'}</div>
                  <div className="text-sm text-gray-500">{editingUser?.email}</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Select Role</div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Super Admin - Full Access</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AdmAsst">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>Assistant Admin - Events & Services</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EventDayViewer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <span>Viewer - Read-only Access</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRole}
              disabled={updateRoleMutation.isPending}
              style={{ background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)', color: '#ffffff' }}
            >
              {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}