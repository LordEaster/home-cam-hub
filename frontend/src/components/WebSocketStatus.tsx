import { useWebSocketStatus } from '@/hooks/useWebSocket';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

/**
 * WebSocket connection status indicator
 * Shows in UI header/footer
 */
export function WebSocketStatus() {
  const { isConnected, isAuthenticated } = useWebSocketStatus();

  if (!isConnected) {
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" />
        <span className="hidden sm:inline">Disconnected</span>
      </Badge>
    );
  }

  if (!isAuthenticated) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Connecting...</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
      <Wifi className="h-3 w-3" />
      <span className="hidden sm:inline">Connected</span>
    </Badge>
  );
}
