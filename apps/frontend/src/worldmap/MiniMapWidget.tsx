import { useEffect, useMemo, useState } from 'react';
import type { QuestMarkerDefinition } from '../types/quest';
import type { MapDiscoveryMarker } from './worldMapExploration';

const MINI_MAP_ZOOM = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface MiniMapWidgetProps {
  mapImagePath: string;
  fallbackMapImagePath?: string;
  playerPosition: { x: number; y: number };
  questMarkers?: QuestMarkerDefinition[];
  trackedMarkerId?: string | null;
  discoveryMarkers?: MapDiscoveryMarker[];
  onOpenViewer: () => void;
}

export function MiniMapWidget({
  mapImagePath,
  fallbackMapImagePath,
  playerPosition,
  questMarkers = [],
  trackedMarkerId = null,
  discoveryMarkers = [],
  onOpenViewer,
}: MiniMapWidgetProps) {
  const [activeImagePath, setActiveImagePath] = useState(mapImagePath);

  useEffect(() => {
    setActiveImagePath(mapImagePath);
  }, [mapImagePath]);

  const trackedMarker = useMemo(
    () => questMarkers.find((entry) => entry.id === trackedMarkerId) ?? null,
    [questMarkers, trackedMarkerId],
  );

  const view = useMemo(() => {
    const width = 1 / MINI_MAP_ZOOM;
    const height = 1 / MINI_MAP_ZOOM;
    const left = clamp(playerPosition.x - width / 2, 0, 1 - width);
    const top = clamp(playerPosition.y - height / 2, 0, 1 - height);
    return { left, top };
  }, [playerPosition.x, playerPosition.y]);

  function handleImageError() {
    if (fallbackMapImagePath && activeImagePath !== fallbackMapImagePath) {
      setActiveImagePath(fallbackMapImagePath);
    }
  }

  return (
    <button
      type="button"
      className="wm-mini-map"
      onClick={onOpenViewer}
      aria-label="Открыть большую карту мира"
      title="Открыть карту мира"
    >
      <div
        className="wm-mini-map-stage"
        style={{
          width: `${MINI_MAP_ZOOM * 100}%`,
          height: `${MINI_MAP_ZOOM * 100}%`,
          left: `${-view.left * MINI_MAP_ZOOM * 100}%`,
          top: `${-view.top * MINI_MAP_ZOOM * 100}%`,
        }}
      >
        <img
          src={activeImagePath}
          alt="Миникарта"
          className="wm-mini-map-image"
          draggable={false}
          onError={handleImageError}
        />
        {trackedMarker ? (
          <span
            className="wm-mini-map-tracked-marker"
            style={{
              left: `${trackedMarker.x * 100}%`,
              top: `${trackedMarker.y * 100}%`,
            }}
          />
        ) : null}
        {discoveryMarkers.map((marker) => (
          <span
            key={marker.id}
            className={`wm-mini-map-discovery-marker is-${marker.entityType}`}
            style={{
              left: `${marker.x * 100}%`,
              top: `${marker.y * 100}%`,
            }}
            title={marker.title}
          />
        ))}
        <span
          className="wm-mini-map-player-marker"
          style={{
            left: `${playerPosition.x * 100}%`,
            top: `${playerPosition.y * 100}%`,
          }}
        />
      </div>
      <span className="wm-mini-map-hint">N: миникарта | M: карта</span>
    </button>
  );
}
