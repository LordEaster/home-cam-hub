
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Hls from 'hls.js';
import { camerasApi } from '../api/cameras';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SOCKET_EVENTS } from '@/constants/socket-events';
import type { CameraStatusPayload } from '@/types/socket';
import { QUERY_KEYS } from '../constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Radio, Volume2, VolumeX, RefreshCw, WifiOff } from 'lucide-react';

interface VideoPlayerProps {
  cameraId: string;
  playbackTime?: string | null;
  preferWebRTC?: boolean;
  quality?: 'hd' | 'sd';
}

export default function VideoPlayer({ cameraId, playbackTime, preferWebRTC = false, quality = 'hd' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  
  const [error, setError] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<'webrtc' | 'hls' | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [cameraOffline, setCameraOffline] = useState(false);
  const [forceReload, setForceReload] = useState(0);

  const { data: streamData, isLoading, error: fetchError } = useQuery({
    queryKey: [...QUERY_KEYS.CAMERAS.STREAM(cameraId), quality, forceReload],
    queryFn: () => camerasApi.getStreamUrl(cameraId, quality),
    enabled: !playbackTime,
    retry: false, // Don't auto-retry, we handle it manually
  });

  // Listen to camera status changes via WebSocket
  useWebSocket<CameraStatusPayload>(
    SOCKET_EVENTS.CAMERA_STATUS,
    (payload) => {
      if (payload.cameraId === cameraId) {
        if (payload.status === 'online') {
          // Camera back online - reload stream
          setCameraOffline(false);
          setError(null);
          retryCountRef.current = 0;
          setForceReload(prev => prev + 1);
        } else {
          // Camera went offline
          setCameraOffline(true);
          setError('Camera is offline');
          // Clean up connections
          cleanup();
        }
      }
    }
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsConnecting(false);
  }, []);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    setError(null);
    setCameraOffline(false);
    retryCountRef.current = 0;
    setForceReload(prev => prev + 1);
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  // WebRTC connection via WHEP
  const connectWebRTC = useCallback(async (streamPath: string) => {
    const video = videoRef.current;
    if (!video) return false;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.play().catch(() => {});
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 2000);
        }
      });

      const whepUrl = `/webrtc/${streamPath}/whep`;
      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP request failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setConnectionType('webrtc');
      setError(null);
      setCameraOffline(false);
      return true;
    } catch (err) {
      console.error('WebRTC connection failed:', err);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      return false;
    }
  }, []);

  // HLS fallback with smart retry logic
  const connectHLS = useCallback((hlsUrl: string, retryCount: number = 0) => {
    const video = videoRef.current;
    if (!video) return;

    const MAX_RETRIES = 5; // Reduced from 10
    const BASE_DELAY = 2000; // Increased to 2 seconds

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 0,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        maxLiveSyncPlaybackRate: 2.0,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
      });

      hlsRef.current.loadSource(hlsUrl);
      hlsRef.current.attachMedia(video);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsConnecting(false);
        setError(null);
        setCameraOffline(false);
        retryCountRef.current = 0;
        video.play().catch(() => {});
      });

      hlsRef.current.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCount < MAX_RETRIES) {
                setIsConnecting(true);
                hlsRef.current?.destroy();
                hlsRef.current = null;
                
                // Exponential backoff with jitter
                const jitter = Math.random() * 1000;
                const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount, 4)) + jitter;
                
                retryTimeoutRef.current = setTimeout(() => {
                  retryCountRef.current = retryCount + 1;
                  connectHLS(hlsUrl, retryCount + 1);
                }, delay);
              } else {
                setCameraOffline(true);
                setError('Stream unavailable. Camera may be offline or initializing.');
                setIsConnecting(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsRef.current?.recoverMediaError();
              break;
            default:
              setError('Failed to load video stream');
              setIsConnecting(false);
              hlsRef.current?.destroy();
              break;
          }
        }
      });

      setConnectionType('hls');
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsConnecting(false);
        setCameraOffline(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        if (retryCount < MAX_RETRIES) {
          setIsConnecting(true);
          const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount, 4));
          retryTimeoutRef.current = setTimeout(() => {
            connectHLS(hlsUrl, retryCount + 1);
          }, delay);
        } else {
          setCameraOffline(true);
          setError('Camera stream not available');
          setIsConnecting(false);
        }
      });
      setConnectionType('hls');
    } else {
      setError('Video streaming not supported');
      setIsConnecting(false);
    }
  }, []);

  // Main connection effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamData) return;

    const connect = async () => {
      const hlsUrl = streamData.hlsUrl;
      const pathMatch = hlsUrl.match(/\/stream\/([^/]+)\//);
      const streamPath = pathMatch ? pathMatch[1] : cameraId;

      if (preferWebRTC) {
        const webrtcSuccess = await connectWebRTC(streamPath);
        if (webrtcSuccess) return;
        console.log('WebRTC failed, falling back to HLS');
      }

      connectHLS(hlsUrl);
    };

    connect();

    // Auto-recovery interval
    const recoveryInterval = setInterval(() => {
      if (video && !video.paused && !video.ended && video.readyState > 2) {
        const hls = hlsRef.current;
        
        if (hls && hls.latency > 10) {
          if (video.buffered.length > 0) {
            video.currentTime = video.buffered.end(video.buffered.length - 1) - 1;
          }
        }
        
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const bufferedAmount = bufferedEnd - video.currentTime;
          
          if (bufferedAmount > 30) {
            video.currentTime = bufferedEnd - 5;
          }
        }
      }
    }, 3000);

    return () => {
      clearInterval(recoveryInterval);
      cleanup();
    };
  }, [streamData, cameraId, preferWebRTC, connectWebRTC, connectHLS, cleanup]);

  if (isLoading || isConnecting) {
    return (
      <Card className="w-full aspect-video flex items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isConnecting ? 'Waiting for stream...' : 'Connecting to camera...'}
          </p>
          {isConnecting && retryCountRef.current > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Attempt {retryCountRef.current}/5
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (fetchError || (error && cameraOffline)) {
    return (
      <Card className="w-full aspect-video flex items-center justify-center bg-muted/50">
        <div className="text-center px-4 space-y-4">
          <WifiOff className="h-16 w-16 text-muted-foreground mx-auto opacity-50" />
          <div>
            <p className="text-sm font-medium text-foreground">Camera Offline</p>
            <p className="text-xs text-muted-foreground mt-1">
              {error || 'Stream is currently unavailable'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Connection
          </Button>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full aspect-video flex items-center justify-center bg-destructive/10 border-destructive/20">
        <div className="text-center px-4 space-y-3">
          <p className="text-destructive font-medium text-sm">{error}</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-t-lg md:rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        playsInline
        autoPlay
      />
      
      {/* Custom Mute Toggle */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
        onClick={toggleMute}
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </Button>

      {/* Connection type badge */}
      {connectionType && (
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 gap-1 px-2 shadow-md bg-black/50 text-white border-none backdrop-blur-sm"
        >
          {connectionType === 'webrtc' ? (
            <>
              <Zap className="h-3 w-3 text-yellow-400" />
              <span className="text-xs">LIVE</span>
            </>
          ) : (
            <>
              <Radio className="h-3 w-3 text-green-400" />
              <span className="text-xs">LIVE</span>
            </>
          )}
        </Badge>
      )}
    </div>
  );
}
