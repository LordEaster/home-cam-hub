import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi, Camera, CreateCameraDto, DiscoveredCamera } from '../../api/cameras';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera as CameraIcon, Plus, Search, Loader2, Trash2, Pencil, Wifi, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleApiError, showSuccessToast, showInfoToast } from '@/lib/error-handler';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function CamerasPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: camerasApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: camerasApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      showSuccessToast('Camera deleted successfully');
    },
    onError: (error) => {
      handleApiError(error, 'Failed to delete camera');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: camerasApi.reorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      showSuccessToast('Cameras reordered successfully');
    },
    onError: (error) => {
      handleApiError(error, 'Failed to reorder cameras');
    },
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discovered = await camerasApi.discover();
      setDiscoveredCameras(discovered);
      showInfoToast(`Found ${discovered.length} camera(s) on network`);
    } catch (error) {
      handleApiError(error, 'Failed to discover cameras');
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete camera "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = cameras.findIndex((c) => c.id === active.id);
      const newIndex = cameras.findIndex((c) => c.id === over.id);

      const newOrder = arrayMove(cameras, oldIndex, newIndex);
      const cameraIds = newOrder.map((c) => c.id);

      reorderMutation.mutate(cameraIds);
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
          <h1 className="text-3xl font-bold tracking-tight">Cameras</h1>
          <p className="text-muted-foreground">Manage surveillance cameras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDiscover} disabled={discovering}>
            {discovering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Discover ONVIF
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Camera
          </Button>
        </div>
      </div>

      {/* Discovered Cameras */}
      {discoveredCameras.length > 0 && (
        <Alert>
          <Wifi className="h-4 w-4" />
          <AlertDescription>
            Found {discoveredCameras.length} camera(s) on network
          </AlertDescription>
        </Alert>
      )}

      {/* Cameras Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cameras ({cameras.length})</CardTitle>
          <CardDescription>View and manage all registered cameras. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Recording</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <CameraIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No cameras configured</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext items={cameras.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {cameras.map((camera) => (
                      <SortableRow
                        key={camera.id}
                        camera={camera}
                        onEdit={setEditingCamera}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </CardContent>
      </Card>

      {/* Modals */}
      {showAddModal && <AddCameraModal onClose={() => setShowAddModal(false)} />}
      {editingCamera && <EditCameraModal camera={editingCamera} onClose={() => setEditingCamera(null)} />}
    </div>
  );
}

// Sortable Row Component
function SortableRow({ 
  camera, 
  onEdit, 
  onDelete 
}: { 
  camera: Camera; 
  onEdit: (camera: Camera) => void; 
  onDelete: (id: string, name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: camera.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/50' : ''}>
      <TableCell>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <div className={cn(
          "h-2 w-2 rounded-full",
          camera.isOnline ? "bg-green-500" : "bg-red-500"
        )} />
      </TableCell>
      <TableCell className="font-medium">{camera.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{camera.type}</Badge>
      </TableCell>
      <TableCell className="font-mono text-sm">{camera.ip}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {camera.hasPtz && <Badge variant="secondary" className="text-xs">PTZ</Badge>}
          {camera.hasAudio && <Badge variant="secondary" className="text-xs">Audio</Badge>}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={camera.isRecording ? "default" : "secondary"}>
          {camera.recordingMode}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(camera)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(camera.id, camera.name)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddCameraModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<CreateCameraDto>>({
    name: '',
    type: 'TAPO',
    ip: '',
    port: 10080,
    recordingMode: 'CONTINUOUS',
    isRecording: true, // Ensure recording starts automatically
  });

  const createMutation = useMutation({
    mutationFn: camerasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      showSuccessToast('Camera added successfully');
      onClose();
    },
    onError: (error) => {
      handleApiError(error, 'Failed to add camera');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as CreateCameraDto);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Camera</DialogTitle>
          <DialogDescription>Configure a new camera for surveillance</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Living Room Camera"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as 'TAPO' | 'ONVIF' | 'GENERIC' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TAPO">TP-Link Tapo</SelectItem>
                <SelectItem value="ONVIF">ONVIF Auto-Discover</SelectItem>
                <SelectItem value="GENERIC">Manual / Generic RTSP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip">IP Address</Label>
            <Input
              id="ip"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              placeholder="192.168.1.100"
              required
            />
          </div>

          {formData.type === 'TAPO' && (
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={formData.model} onValueChange={(v) => setFormData({ ...formData, model: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {['C100', 'C110', 'C200', 'C210', 'C220', 'C310', 'C320WS', 'C500', 'C520WS'].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.type === 'GENERIC' && (
            <>
               <div className="space-y-2">
                <Label htmlFor="rtsp-main">Main Stream RTSP URL (Required)</Label>
                <Input
                  id="rtsp-main"
                  value={formData.rtspMainStream || ''}
                  onChange={(e) => setFormData({ ...formData, rtspMainStream: e.target.value })}
                  placeholder="rtsp://user:pass@ip:554/stream1"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Example: rtsp://admin:password@192.168.1.53:554/stream1
                </p>
              </div>

               <div className="space-y-2">
                <Label htmlFor="rtsp-sub">Sub Stream RTSP URL (Optional)</Label>
                <Input
                  id="rtsp-sub"
                  value={formData.rtspSubStream || ''}
                  onChange={(e) => setFormData({ ...formData, rtspSubStream: e.target.value })}
                  placeholder="rtsp://user:pass@ip:554/stream2"
                />
              </div>
            </>
          )}

          {formData.type === 'ONVIF' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="port">ONVIF Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port || 10080}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  placeholder="10080"
                />
                <p className="text-xs text-muted-foreground">
                  Default: 10080 (ONVIF), 554 (RTSP standard)
                </p>
              </div>
              
              {/* ... existing fields ... */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter camera password"
                />
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>RTSP URL:</strong> rtsp://{formData.ip || '192.168.1.53'}:10554/udp/av0_0<br />
                  <strong>ONVIF URL:</strong> http://{formData.ip || '192.168.1.53'}:10080/onvif/device_service
                </AlertDescription>
              </Alert>
            </>
          )}

          <div className="space-y-3">
            <Label>Features</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ptz"
                checked={formData.hasPtz}
                onCheckedChange={(checked) => setFormData({ ...formData, hasPtz: !!checked })}
              />
              <Label htmlFor="ptz" className="font-normal">PTZ Control</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="audio"
                checked={formData.hasAudio}
                onCheckedChange={(checked) => setFormData({ ...formData, hasAudio: !!checked })}
              />
              <Label htmlFor="audio" className="font-normal">Audio Support</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recording">Recording Mode</Label>
            <Select value={formData.recordingMode} onValueChange={(v) => setFormData({ ...formData, recordingMode: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTINUOUS">Continuous (24/7)</SelectItem>
                <SelectItem value="MOTION">Motion Detection</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
                <SelectItem value="OFF">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Camera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCameraModal({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: camera.name,
    hasPtz: camera.hasPtz,
    hasAudio: camera.hasAudio,
    recordingMode: camera.recordingMode,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateCameraDto>) => camerasApi.update(camera.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      showSuccessToast('Camera updated successfully');
      onClose();
    },
    onError: (error) => {
      handleApiError(error, 'Failed to update camera');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Camera</DialogTitle>
          <DialogDescription>Update camera settings</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Features</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-ptz"
                checked={formData.hasPtz}
                onCheckedChange={(checked) => setFormData({ ...formData, hasPtz: !!checked })}
              />
              <Label htmlFor="edit-ptz" className="font-normal">PTZ Control</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-audio"
                checked={formData.hasAudio}
                onCheckedChange={(checked) => setFormData({ ...formData, hasAudio: !!checked })}
              />
              <Label htmlFor="edit-audio" className="font-normal">Audio Support</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-recording">Recording Mode</Label>
            <Select value={formData.recordingMode} onValueChange={(v) => setFormData({ ...formData, recordingMode: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTINUOUS">Continuous</SelectItem>
                <SelectItem value="MOTION">Motion</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
                <SelectItem value="OFF">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
