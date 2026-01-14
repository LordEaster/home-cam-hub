import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { camerasApi } from '../api/cameras';
import { usePtzSocket } from '../api/usePtzSocket';
import { QUERY_KEYS } from '../constants';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Circle,
  Loader2
} from 'lucide-react';

type PtzDirection = 'up' | 'down' | 'left' | 'right';

interface PTZControlsProps {
  cameraId: string;
}

export default function PTZControls({ cameraId }: PTZControlsProps) {
  const { isConnected, isMoving, startMove, stopMove } = usePtzSocket();

  const { data: presets = [] } = useQuery({
    queryKey: QUERY_KEYS.CAMERAS.PRESETS(cameraId),
    queryFn: () => camerasApi.getPresets(cameraId),
  });

  const handleStartMove = useCallback((direction: PtzDirection) => {
    startMove(cameraId, direction);
  }, [cameraId, startMove]);

  const handleStopMove = useCallback(() => {
    stopMove(cameraId);
  }, [cameraId, stopMove]);

  const handlePreset = useCallback(async (presetId: string) => {
    try {
      await camerasApi.goToPreset(cameraId, presetId);
    } catch {
      // Handle error
    }
  }, [cameraId]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((direction: PtzDirection) => (e: React.TouchEvent) => {
    e.preventDefault();
    startMove(cameraId, direction);
  }, [cameraId, startMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    stopMove(cameraId);
  }, [cameraId, stopMove]);

  const buttonClass = (isActive: boolean) => `
    w-16 h-16 sm:w-20 sm:h-20 
    flex items-center justify-center 
    rounded-2xl 
    transition-all duration-150
    ${isActive 
      ? 'bg-primary text-primary-foreground scale-95' 
      : 'bg-secondary text-foreground hover:bg-primary/20 active:bg-primary active:text-primary-foreground'
    }
    ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    touch-none select-none
  `;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* D-Pad Style Controls */}
      <div className="relative">
        {/* Loading Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-3xl">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Connecting...</span>
            </div>
          </div>
        )}

        {/* Grid layout for D-pad */}
        <div className={`grid grid-cols-3 gap-2 transition-opacity duration-200 ${!isConnected ? 'opacity-50' : 'opacity-100'}`}>
          {/* Top row */}
          <div />
          <button
            className={buttonClass(isMoving)}
            onMouseDown={() => isConnected && handleStartMove('up')}
            onMouseUp={handleStopMove}
            onMouseLeave={handleStopMove}
            onTouchStart={handleTouchStart('up')}
            onTouchEnd={handleTouchEnd}
            disabled={!isConnected}
            aria-label="เลื่อนขึ้น"
          >
            <ChevronUp className="w-10 h-10" strokeWidth={2.5} />
          </button>
          <div />

          {/* Middle row */}
          <button
            className={buttonClass(isMoving)}
            onMouseDown={() => isConnected && handleStartMove('left')}
            onMouseUp={handleStopMove}
            onMouseLeave={handleStopMove}
            onTouchStart={handleTouchStart('left')}
            onTouchEnd={handleTouchEnd}
            disabled={!isConnected}
            aria-label="เลื่อนซ้าย"
          >
            <ChevronLeft className="w-10 h-10" strokeWidth={2.5} />
          </button>
          <div className={`
            w-16 h-16 sm:w-20 sm:h-20 
            flex items-center justify-center 
            rounded-full 
            bg-muted
            ${isMoving ? 'animate-pulse' : ''}
          `}>
            <Circle className="w-6 h-6 text-muted-foreground" />
          </div>
          <button
            className={buttonClass(isMoving)}
            onMouseDown={() => isConnected && handleStartMove('right')}
            onMouseUp={handleStopMove}
            onMouseLeave={handleStopMove}
            onTouchStart={handleTouchStart('right')}
            onTouchEnd={handleTouchEnd}
            disabled={!isConnected}
            aria-label="เลื่อนขวา"
          >
            <ChevronRight className="w-10 h-10" strokeWidth={2.5} />
          </button>

          {/* Bottom row */}
          <div />
          <button
            className={buttonClass(isMoving)}
            onMouseDown={() => isConnected && handleStartMove('down')}
            onMouseUp={handleStopMove}
            onMouseLeave={handleStopMove}
            onTouchStart={handleTouchStart('down')}
            onTouchEnd={handleTouchEnd}
            disabled={!isConnected}
            aria-label="เลื่อนลง"
          >
            <ChevronDown className="w-10 h-10" strokeWidth={2.5} />
          </button>
          <div />
        </div>
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div className="w-full mt-4">
          <div className="text-sm text-muted-foreground mb-2">ตำแหน่งที่บันทึก:</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset.id)}
                className="px-4 py-3 min-h-[48px] bg-secondary rounded-xl text-foreground font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
