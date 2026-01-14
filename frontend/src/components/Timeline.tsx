import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import client from '../api/client';
import { API_ENDPOINTS, QUERY_KEYS } from '../constants';

interface TimelineProps {
  cameraId: string;
  date: string;
  onTimeSelect: (time: string) => void;
}

interface TimelineEntry {
  startTime: string;
  endTime: string;
  hasMotion: boolean;
}

async function fetchTimeline(cameraId: string, date: string): Promise<TimelineEntry[]> {
  const response = await client.get(API_ENDPOINTS.RECORDINGS.TIMELINE, {
    params: { cameraId, date },
  });
  return response.data;
}

export default function Timeline({ cameraId, date, onTimeSelect }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPosition, setCurrentPosition] = useState<number | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.RECORDINGS.TIMELINE(cameraId, date),
    queryFn: () => fetchTimeline(cameraId, date),
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    
    // Calculate time based on position (0-24 hours)
    const hours = Math.floor(percentage * 24);
    const minutes = Math.floor((percentage * 24 - hours) * 60);
    
    const time = dayjs(date)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .toISOString();
    
    setCurrentPosition(percentage * 100);
    onTimeSelect(time);
  };

  // Convert entries to visual segments
  const segments = entries.map((entry) => {
    const dayStart = dayjs(date).startOf('day');
    const startTime = dayjs(entry.startTime);
    const endTime = dayjs(entry.endTime);
    
    const startPercent = (startTime.diff(dayStart, 'minute') / (24 * 60)) * 100;
    const endPercent = (endTime.diff(dayStart, 'minute') / (24 * 60)) * 100;
    
    return {
      left: `${startPercent}%`,
      width: `${endPercent - startPercent}%`,
      hasMotion: entry.hasMotion,
    };
  });

  // Generate hour markers
  const hourMarkers = Array.from({ length: 25 }, (_, i) => i);

  if (isLoading) {
    return <div className="timeline loading">Loading timeline...</div>;
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span className="timeline-date">{dayjs(date).format('MMMM D, YYYY')}</span>
      </div>
      
      <div className="timeline-track" ref={containerRef} onClick={handleClick}>
        {/* Hour markers */}
        <div className="hour-markers">
          {hourMarkers.map((hour) => (
            <div
              key={hour}
              className="hour-marker"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {hour % 3 === 0 && (
                <span className="hour-label">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Recording segments */}
        <div className="segments">
          {segments.map((segment, i) => (
            <div
              key={i}
              className={`segment ${segment.hasMotion ? 'motion' : ''}`}
              style={{ left: segment.left, width: segment.width }}
            />
          ))}
        </div>

        {/* Current position indicator */}
        {currentPosition !== null && (
          <div
            className="position-indicator"
            style={{ left: `${currentPosition}%` }}
          />
        )}
      </div>
    </div>
  );
}
