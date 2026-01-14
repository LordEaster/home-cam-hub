import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@/constants/socket-events';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  subscribe: <T = any>(event: string, callback: (data: T) => void) => () => void;
  emit: (event: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

/**
 * WebSocket Provider
 * Manages Socket.IO connection and authentication
 */
export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Initialize Socket.IO connection
    // Cookies (accessToken, refreshToken) are sent automatically by browser
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const newSocket = io(socketUrl, {
      withCredentials: true, // Important: Send cookies with requests
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    newSocket.on(SOCKET_EVENTS.AUTHENTICATED, (data: { userId: string }) => {
      console.log('[WebSocket] Authenticated:', data.userId);
      setIsAuthenticated(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Cleaning up...');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, []);

  /**
   * Subscribe to WebSocket event
   * Returns unsubscribe function
   */
  const subscribe = useCallback(
    <T = any>(event: string, callback: (data: T) => void) => {
      if (!socket) {
        console.warn('[WebSocket] Cannot subscribe: socket not initialized');
        return () => {};
      }

      socket.on(event, callback);
      console.log('[WebSocket] Subscribed to:', event);

      // Return unsubscribe function
      return () => {
        socket.off(event, callback);
        console.log('[WebSocket] Unsubscribed from:', event);
      };
    },
    [socket]
  );

  /**
   * Emit event to server
   */
  const emit = useCallback(
    (event: string, data?: any) => {
      if (!socket || !isConnected) {
        console.warn('[WebSocket] Cannot emit: not connected');
        return;
      }
      socket.emit(event, data);
    },
    [socket, isConnected]
  );

  const value: WebSocketContextValue = {
    socket,
    isConnected,
    isAuthenticated,
    subscribe,
    emit,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

/**
 * Hook to access WebSocket context
 */
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
