import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

/**
 * Hook for subscribing to WebSocket events
 * Automatically handles cleanup on unmount
 * 
 * @example
 * useWebSocket('camera:status', (data) => {
 *   console.log('Camera status:', data);
 * });
 */
export function useWebSocket<T = any>(
  event: string,
  callback: (data: T) => void,
  enabled = true
) {
  const { subscribe, isConnected, isAuthenticated } = useWebSocketContext();
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isConnected || !isAuthenticated) {
      return;
    }

    // Subscribe with stable callback reference
    const unsubscribe = subscribe<T>(event, (data) => {
      callbackRef.current(data);
    });

    return unsubscribe;
  }, [event, enabled, isConnected, isAuthenticated, subscribe]);
}

/**
 * Hook for emitting WebSocket events
 * Returns emit function
 */
export function useWebSocketEmit() {
  const { emit, isConnected } = useWebSocketContext();
  
  return useCallback(
    (event: string, data?: any) => {
      if (!isConnected) {
        console.warn(`[useWebSocketEmit] Cannot emit "${event}": not connected`);
        return;
      }
      emit(event, data);
    },
    [emit, isConnected]
  );
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  const { isConnected, isAuthenticated } = useWebSocketContext();
  return { isConnected, isAuthenticated };
}
