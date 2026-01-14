import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User } from '../../api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Users2, Plus, Loader2, Trash2, Shield, Key } from 'lucide-react';
import { camerasApi } from '../../api/cameras';
import { handleApiError, showSuccessToast, showWarningToast } from '@/lib/error-handler';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; username: string } | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<{ id: string; username: string } | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await usersApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserToDelete(null);
      showSuccessToast('User deleted successfully');
    },
    onError: (error) => {
      handleApiError(error, 'Failed to delete user');
    },
  });

  const handleDeleteClick = (user: User) => {
    if (user.role === 'ADMIN') {
      showWarningToast('Cannot delete admin users');
      return;
    }
    setUserToDelete({ id: user.id, username: user.username });
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
          <CardDescription>View and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Users2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {user.role === 'ADMIN' && <Shield className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPermissionsUser({ id: user.id, username: user.username })}
                          disabled={user.role === 'ADMIN'}
                          title="Manage Permissions"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(user)}
                          disabled={user.role === 'ADMIN'}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} />}
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the user "{userToDelete?.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {permissionsUser && (
        <ManagePermissionsDialog 
          userId={permissionsUser.id} 
          username={permissionsUser.username} 
          onClose={() => setPermissionsUser(null)} 
        />
      )}
    </div>
  );
}

function AddUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    role: 'USER',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        email: data.email === '' ? undefined : data.email,
      };
      await usersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccessToast('User created successfully');
      onClose();
    },
    onError: (error) => {
      handleApiError(error, 'Failed to create user');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new user account</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManagePermissionsDialog({ 
  userId, 
  username, 
  onClose 
}: { 
  userId: string; 
  username: string; 
  onClose: () => void 
}) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<any[]>([]);

  // Fetch all cameras
  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: camerasApi.getAll,
  });

  // Fetch user permissions
  const { data: userPermissionsData, isLoading } = useQuery({
    queryKey: ['users', userId, 'permissions'],
    queryFn: () => usersApi.getPermissions(userId),
  });

  // Merge cameras with permissions when data loads
  useEffect(() => {
    if (cameras && userPermissionsData) {
      const merged = cameras.map(camera => {
        const existing = userPermissionsData.permissions.find(p => p.cameraId === camera.id);
        return {
          cameraId: camera.id,
          cameraName: camera.name,
          canViewLive: existing?.canViewLive ?? false,
          canPlayback: existing?.canPlayback ?? false,
          canControl: existing?.canControl ?? false,
          canExport: existing?.canExport ?? false,
        };
      });
      setPermissions(merged);
    } else if (cameras) {
       // Initialize with default permissions (all false) if no user permissions yet
       const initial = cameras.map(camera => ({
          cameraId: camera.id,
          cameraName: camera.name,
          canViewLive: false,
          canPlayback: false,
          canControl: false,
          canExport: false,
       }));
       setPermissions(initial);
    }
  }, [cameras, userPermissionsData]);

  const updateMutation = useMutation({
    mutationFn: async (updatedPermissions: any[]) => {
      await usersApi.setPermissions(userId, updatedPermissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'permissions'] });
      showSuccessToast(`Permissions for ${username} have been saved`);
      onClose();
    },
    onError: (error) => {
      handleApiError(error, 'Failed to update permissions');
    },
  });

  const togglePermission = (cameraId: string, field: string) => {
    setPermissions(prev => prev.map(p => 
      p.cameraId === cameraId ? { ...p, [field]: !p[field] } : p
    ));
  };

  const handleSave = () => {
    // Strip cameraName before sending (backend DTO doesn't accept it)
    const cleanedPermissions = permissions.map(({ cameraName, ...rest }) => rest);
    updateMutation.mutate(cleanedPermissions);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Permissions - {username}</DialogTitle>
          <DialogDescription>
            Configure camera access levels for this user.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camera</TableHead>
                <TableHead className="text-center">View Live</TableHead>
                <TableHead className="text-center">Playback</TableHead>
                <TableHead className="text-center">PTZ Control</TableHead>
                <TableHead className="text-center">Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.cameraId}>
                  <TableCell className="font-medium">{perm.cameraName}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={perm.canViewLive} 
                      onCheckedChange={() => togglePermission(perm.cameraId, 'canViewLive')} 
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={perm.canPlayback} 
                      onCheckedChange={() => togglePermission(perm.cameraId, 'canPlayback')} 
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={perm.canControl} 
                      onCheckedChange={() => togglePermission(perm.cameraId, 'canControl')} 
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={perm.canExport} 
                      onCheckedChange={() => togglePermission(perm.cameraId, 'canExport')} 
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
