
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Hls from 'hls.js';
import { camerasApi } from '../api/cameras';
import { QUERY_KEYS } from '../constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Loader2, Zap, Radio, Volume2, VolumeX } from 'lucide-react';

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

  const { data: streamData, isLoading, error: fetchError } = useQuery({
    queryKey: [...QUERY_KEYS.CAMERAS.STREAM(cameraId), quality],
    queryFn: () => camerasApi.getStreamUrl(cameraId, quality),
    enabled: !playbackTime,
  });

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
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add transceivers for receiving
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.play().catch(() => {});
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          // Timeout after 2 seconds
          setTimeout(resolve, 2000);
        }
      });

      // Send offer to MediaMTX WHEP endpoint
      const whepUrl = `/webrtc/${streamPath}/whep`;
      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP request failed: ${response.status}`);
      }

      // Set remote description
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setConnectionType('webrtc');
      setError(null);
      return true;
    } catch (err) {
      console.error('WebRTC connection failed:', err);
      // Clean up failed connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      return false;
    }
  }, []);

  // HLS fallback with retry logic for 404 errors
  const connectHLS = useCallback((hlsUrl: string, retryCount: number = 0) => {
    const video = videoRef.current;
    if (!video) return;

    const MAX_RETRIES = 10;
    const BASE_DELAY = 1000; // 1 second

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        
        // Aggressive buffer management to prevent memory buildup
        maxBufferLength: 10,           // Keep only 10 seconds ahead
        maxMaxBufferLength: 20,         // Never exceed 20 seconds
        backBufferLength: 0,            // Don't keep old segments (save memory)
        
        // Low Latency Settings
        liveSyncDurationCount: 3,       // Target ~3 segments latency
        liveMaxLatencyDurationCount: 10, // If too far behind, jump to live
        maxLiveSyncPlaybackRate: 2.0,   // Speed up to 2x to catch up
        
        // Fragment loading optimization
        maxBufferSize: 60 * 1000 * 1000, // 60 MB max buffer size
        maxBufferHole: 0.5,              // Skip gaps larger than 0.5s
      });

      hlsRef.current.loadSource(hlsUrl);
      hlsRef.current.attachMedia(video);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsConnecting(false);
        setError(null);
        retryCountRef.current = 0;
        video.play().catch(() => {});
      });

      hlsRef.current.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
           switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Retry on any network error if we haven't exceeded max retries
              if (retryCount < MAX_RETRIES) {
                setIsConnecting(true);
                
                // Clean up current HLS instance
                hlsRef.current?.destroy();
                hlsRef.current = null;
                
                // Exponential backoff: 1s, 2s, 4s, 8s, etc.
                const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount, 5));
                retryTimeoutRef.current = setTimeout(() => {
                  retryCountRef.current = retryCount + 1;
                  connectHLS(hlsUrl, retryCount + 1);
                }, delay);
              } else {
                setError('Camera stream not available. The camera may be offline or still initializing.');
                setIsConnecting(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsRef.current?.recoverMediaError();
              break;
            default:
              // Cannot recover
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
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        if (retryCount < MAX_RETRIES) {
          setIsConnecting(true);
          const delay = BASE_DELAY * Math.pow(2, Math.min(retryCount, 5));
          retryTimeoutRef.current = setTimeout(() => {
            connectHLS(hlsUrl, retryCount + 1);
          }, delay);
        } else {
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
      // Extract stream path from HLS URL (e.g., /stream/{path}/index.m3u8 -> {path})
      const hlsUrl = streamData.hlsUrl;
      const pathMatch = hlsUrl.match(/\/stream\/([^/]+)\//);
      const streamPath = pathMatch ? pathMatch[1] : cameraId;

      // Try WebRTC first if preferred
      if (preferWebRTC) {
        const webrtcSuccess = await connectWebRTC(streamPath);
        if (webrtcSuccess) return;
        console.log('WebRTC failed, falling back to HLS');
      }

      // Fallback to HLS
      connectHLS(hlsUrl);
    };

    connect();

    // Auto-recovery interval: check if stuck or far behind live
    // More aggressive cleanup to prevent buffer buildup
    const recoveryInterval = setInterval(() => {
        if (video && !video.paused && !video.ended && video.readyState > 2) {
          const hls = hlsRef.current;
          
          // Jump to live if latency is too high (> 10 seconds)
          if (hls && hls.latency > 10) {
            if (video.buffered.length > 0) {
              video.currentTime = video.buffered.end(video.buffered.length - 1) - 1;
            }
          }
          
          // Aggressive buffer cleanup: if we have more than 30 seconds buffered, clear old data
          if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const bufferedAmount = bufferedEnd - video.currentTime;
            
            if (bufferedAmount > 30) {
              // Jump closer to live edge to trigger buffer cleanup
              video.currentTime = bufferedEnd - 5;
            }
          }
        }
    }, 3000); // Check every 3 seconds

    return () => {
      clearInterval(recoveryInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;
      setIsConnecting(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [streamData, cameraId, preferWebRTC, connectWebRTC, connectHLS]);

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
              Attempt {retryCountRef.current}/10
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (fetchError || error) {
    return (
      <Card className="w-full aspect-video flex items-center justify-center bg-destructive/10 border-destructive/20">
        <div className="text-center px-4">
          <p className="text-destructive font-medium">{error || 'Failed to load stream'}</p>
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
        // No controls attribute for clean look
      />
      
      {/* Custom Mute Toggle */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none shadow-lg transition-colors duration-200"
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
