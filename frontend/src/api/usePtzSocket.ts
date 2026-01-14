import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type PtzDirection = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

interface UsePtzSocketReturn {
  isConnected: boolean;
  isMoving: boolean;
  startMove: (cameraId: string, direction: PtzDirection) => void;
  stopMove: (cameraId: string) => void;
}

export function usePtzSocket(): UsePtzSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    // In dev mode, connect directly to backend (port 3001)
    // In prod, use relative path '/' which automatically resolves to current origin (domain name)
    const wsUrl = import.meta.env.DEV 
      ? 'http://localhost:3001' 
      : '/';
    
    const socket = io(wsUrl, {
      // Re-enable polling fallback to support proxies that don't handle WebSockets well
      transports: ['websocket', 'polling'],
      path: '/socket.io', // Standard path without trailing slash
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsMoving(false);
    });

    socket.on('ptz:moving', () => {
      setIsMoving(true);
    });

    socket.on('ptz:stopped', () => {
      setIsMoving(false);
    });

    socket.on('ptz:error', (data: { message: string }) => {
      console.error('PTZ error:', data.message);
      setIsMoving(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const startMove = useCallback((cameraId: string, direction: PtzDirection) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ptz:move', { cameraId, direction });
    }
  }, []);

  const stopMove = useCallback((cameraId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ptz:stop', { cameraId });
    }
    setIsMoving(false);
  }, []);

  return { isConnected, isMoving, startMove, stopMove };
}
