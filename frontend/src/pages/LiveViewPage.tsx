import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Maximize2, Minimize2, Grid3X3, Smartphone } from 'lucide-react';
import { camerasApi } from '../api/cameras';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SOCKET_EVENTS } from '@/constants/socket-events';
import type { CameraStatusPayload } from '@/types/socket';
import VideoPlayer from '../components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function LiveViewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nvrMode, setNvrMode] = useState(false);
  
  const { data: cameras = [], isLoading, error } = useQuery({
    queryKey: ['cameras'],
    queryFn: camerasApi.getAll,
  });

  // Real-time camera status updates via WebSocket
  useWebSocket<CameraStatusPayload>(
    SOCKET_EVENTS.CAMERA_STATUS,
    (payload) => {
      // Update camera list in real-time
      queryClient.setQueryData(['cameras'], (oldData: any[] = []) =>
        oldData.map((cam) =>
          cam.id === payload.cameraId
            ? { ...cam, isOnline: payload.status === 'online' }
            : cam
        )
      );

      // Show toast notification
      const camera = cameras.find((c) => c.id === payload.cameraId);
      if (camera) {
        if (payload.status === 'offline') {
          toast.error(`${camera.name} is now offline`);
        } else {
          toast.success(`${camera.name} is back online`);
        }
      }
    }
  );

  // Auto-reload at 3 AM for NVR maintenance (24/7 operation)
  useEffect(() => {
    const checkReload = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Reload at 3:00 AM every day for memory cleanup
      if (hours === 3 && minutes === 0) {
        window.location.reload();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkReload);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-muted-foreground animate-pulse">Loading cameras...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-destructive">
        Failed to load cameras
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 h-full", nvrMode && "h-screen")}>
      {!nvrMode && (
        <div className="flex items-center justify-between pb-2 border-b md:border-none">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live View</h1>
            <p className="text-muted-foreground text-sm hidden md:block">
              {cameras.length} camera{cameras.length !== 1 && 's'} online
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setNvrMode(true)}
              className="hidden md:flex gap-2"
            >
              <Maximize2 className="h-4 w-4" />
              NVR Mode
            </Button>
            <div className="md:hidden text-xs text-muted-foreground flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              Mobile View
            </div>
          </div>
        </div>
      )}

      {nvrMode && (
        <div className="fixed top-4 right-4 z-50">
           <Button 
              variant="secondary" 
              size="sm" 
              className="shadow-md opacity-80 hover:opacity-100 transition-opacity"
              onClick={() => setNvrMode(false)}
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit NVR
            </Button>
        </div>
      )}

      {/* Grid Container */}
      <div className={cn(
        "w-full transition-all duration-300",
        // Mobile: Vertical Stack
        "flex flex-col gap-4 md:grid",
        // Desktop: Responsive Grid
        "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        // NVR Mode: Tighter grid, full height
        nvrMode ? "flex flex-col flex-wrap gap-1 p-1" : "gap-4"
      )}>
        {cameras.map((camera) => (
          <Card 
            key={camera.id}
            className={cn(
              "overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all group",
              nvrMode ? "rounded-sm border-0 bg-black" : "bg-card"
            )}
            onClick={() => !nvrMode && navigate(`/cameras/${camera.id}`)}
          >

            {/* Video Content */}
            <div className="aspect-video bg-muted relative">
               <VideoPlayer cameraId={camera.id} quality={nvrMode ? "sd" : "hd"} />
            </div>
            
            {/* Footer info for mobile/standard view */}
            {!nvrMode && (
              <div className="p-3 bg-card border-t flex justify-between items-center text-xs text-muted-foreground md:hidden">
                <span>{camera.name}</span>
                <Badge variant={camera.isOnline ? "default" : "destructive"}>
                  {camera.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
            )}
          </Card>
        ))}

        {cameras.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Grid3X3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No Cameras Found</h3>
            <p className="text-muted-foreground mt-2">Add cameras in the admin settings to start monitoring.</p>
          </div>
        )}
      </div>
    </div>
  );
}
