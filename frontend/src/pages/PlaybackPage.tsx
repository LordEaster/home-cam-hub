import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { camerasApi, Camera } from '../api/cameras';
import VideoPlayer from '../components/VideoPlayer';
import Timeline from '../components/Timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlaybackPage() {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: camerasApi.getAll,
  });

  const handleTimeSelect = (time: string) => {
    setCurrentTime(time);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Sidebar */}
      <Card className="w-full lg:w-80 flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Playback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={dayjs().format('YYYY-MM-DD')}
            />
          </div>

          {/* Camera Selection */}
          <div className="space-y-2">
            <Label>Camera</Label>
            <div className="space-y-2 max-h-64 lg:max-h-96 overflow-y-auto">
              {cameras.map((camera) => (
                <button
                  key={camera.id}
                  onClick={() => setSelectedCamera(camera)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                    selectedCamera?.id === camera.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent border-border"
                  )}
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    camera.isOnline ? "bg-green-500" : "bg-red-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{camera.name}</p>
                    <p className={cn(
                      "text-xs truncate",
                      selectedCamera?.id === camera.id ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {camera.model || 'Unknown Model'}
                    </p>
                  </div>
                </button>
              ))}
              {cameras.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No cameras available
                </p>
              )}
            </div>
          </div>

          {/* Camera Info */}
          {selectedCamera && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model:</span>
                  <span className="font-medium">{selectedCamera.model || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline">{selectedCamera.type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={selectedCamera.isOnline ? "default" : "destructive"}>
                    {selectedCamera.isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {selectedCamera ? (
          <>
            {/* Video Player */}
            <Card className="flex-1">
              <CardContent className="p-0 h-full">
                <VideoPlayer
                  cameraId={selectedCamera.id}
                  playbackTime={currentTime}
                />
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardContent className="p-4">
                <Timeline
                  cameraId={selectedCamera.id}
                  date={selectedDate}
                  onTimeSelect={handleTimeSelect}
                />
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="hidden md:block">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Current Time:</Label>
                  <span className="font-mono text-lg font-semibold">
                    {currentTime ? dayjs(currentTime).format('HH:mm:ss') : '--:--:--'}
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Clip
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="flex-1 flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Camera Selected</h3>
              <p className="text-muted-foreground">
                Select a camera from the {window.innerWidth < 1024 ? 'list above' : 'sidebar'} to view recordings
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
