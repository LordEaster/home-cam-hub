import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { camerasApi } from '../api/cameras';
import VideoPlayer from '../components/VideoPlayer';
import PTZControls from '../components/PTZControls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Video, Settings2, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: camera, isLoading, error } = useQuery({
    queryKey: ['camera', id],
    queryFn: () => camerasApi.getOne(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !camera) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-destructive">Failed to load camera</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{camera.name}</h1>
            <p className="text-muted-foreground text-sm">{camera.ip}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={camera.isOnline ? "default" : "destructive"}>
            {camera.isOnline ? 'Online' : 'Offline'}
          </Badge>
          {camera.isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              Recording
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video Player - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <VideoPlayer cameraId={camera.id} quality="hd" />
            </CardContent>
          </Card>

          {/* Camera Info - Collapsible on Mobile */}
          <Card className="lg:hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <CardTitle className="text-base">Camera Info</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    const content = e.currentTarget.parentElement?.parentElement?.nextElementSibling;
                    if (content) {
                      content.classList.toggle('hidden');
                    }
                  }}
                >
                  {/* Toggle icon will be controlled by click */}
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
              {/* Quick Summary - Always Visible on Mobile */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge variant="outline" className="text-xs">{camera.type}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Recording</p>
                  <Badge variant="outline" className="text-xs">{camera.recordingMode}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">PTZ</p>
                  <Badge variant={camera.hasPtz ? "default" : "secondary"} className="text-xs">
                    {camera.hasPtz ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {/* Expandable Details */}
            <CardContent className="hidden">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Model</p>
                  <p className="font-medium">{camera.model || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP Address</p>
                  <p className="font-medium font-mono text-xs">{camera.ip}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Audio</p>
                  <Badge variant={camera.hasAudio ? "default" : "secondary"} className="text-xs">
                    {camera.hasAudio ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Camera Info Tabs - Desktop Only */}
          <Tabs defaultValue="info" className="w-full hidden lg:block">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">
                <Info className="h-4 w-4 mr-2" />
                Information
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Camera Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{camera.model || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{camera.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IP Address</p>
                    <p className="font-medium font-mono text-sm">{camera.ip}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recording Mode</p>
                    <Badge variant="outline">{camera.recordingMode}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PTZ Support</p>
                    <Badge variant={camera.hasPtz ? "default" : "secondary"}>
                      {camera.hasPtz ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Audio Support</p>
                    <Badge variant={camera.hasAudio ? "default" : "secondary"}>
                      {camera.hasAudio ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Camera Settings</CardTitle>
                  <CardDescription>
                    Configure camera recording and behavior
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Settings panel coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* PTZ Controls - 1 column on large screens */}
        {camera.hasPtz && (
          <div>
            <PTZControls cameraId={camera.id} />
          </div>
        )}

        {/* Placeholder if no PTZ */}
        {!camera.hasPtz && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Fixed Camera
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This camera does not support PTZ (Pan-Tilt-Zoom) controls
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
