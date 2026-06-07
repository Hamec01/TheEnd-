import { useEffect, useMemo, useState } from 'react';
import type { QuestMarkerDefinition } from '../types/quest';
import type { MapDiscoveryMarker } from './worldMapExploration';
import { getQuestMarkerRuntimeMeta } from './questVisuals';

const MINI_MAP_ZOOM = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

import type { WorldMapZone } from './zoneEditorTypes';

interface MiniMapWidgetProps {
  mapImagePath: string;
  fallbackMapImagePath?: string;
  playerPosition: { x: number; y: number };
  questMarkers?: QuestMarkerDefinition[];
  trackedMarkerId?: string | null;
  discoveryMarkers?: MapDiscoveryMarker[];
  onOpenViewer: () => void;
  zones?: WorldMapZone[];
  showProfessionResourceZones?: boolean;
  selectedProfessionOverlay?: string;
}

export function MiniMapWidget({
  mapImagePath,
  fallbackMapImagePath,
  playerPosition,
  questMarkers = [],
  trackedMarkerId = null,
  discoveryMarkers = [],
  onOpenViewer,
  zones = [],
  showProfessionResourceZones = false,
  selectedProfessionOverlay = 'none',
}: MiniMapWidgetProps) {
  const [activeImagePath, setActiveImagePath] = useState(mapImagePath);

  useEffect(() => {
    setActiveImagePath(mapImagePath);
  }, [mapImagePath]);

  const trackedMarker = useMemo(
    () => questMarkers.find((entry) => entry.id === trackedMarkerId) ?? null,
    [questMarkers, trackedMarkerId],
  );
  const trackedMarkerIcon = trackedMarker ? getQuestMarkerRuntimeMeta(trackedMarker).runtimeQuestIconUrl : undefined;

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
      data-tutorial="mini-map-panel"
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
        {showProfessionResourceZones && selectedProfessionOverlay === 'carpenter' ? (
          <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1 1">
            {zones.map((zone) => {
              if (zone.resourceKind !== 'forest') {
                return null;
              }
              if (zone.shape === 'circle') {
                return (
                  <circle
                    key={zone.id}
                    cx={zone.x ?? 0}
                    cy={zone.y ?? 0}
                    r={zone.radius ?? 0.03}
                    fill="rgba(74, 117, 89, 0.25)"
                    stroke="rgba(139, 90, 43, 0.6)"
                    strokeWidth="0.002"
                  />
                );
              } else {
                const pts = zone.points ?? [];
                if (pts.length === 0) {
                  return null;
                }
                return (
                  <polygon
                    key={zone.id}
                    points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')}
                    fill="rgba(74, 117, 89, 0.25)"
                    stroke="rgba(139, 90, 43, 0.6)"
                    strokeWidth="0.002"
                  />
                );
              }
            })}
          </svg>
        ) : null}
        {trackedMarker ? (
          <span
            className={`wm-mini-map-tracked-marker${trackedMarkerIcon ? ' has-image' : ''}`}
            style={{
              left: `${trackedMarker.x * 100}%`,
              top: `${trackedMarker.y * 100}%`,
              ...(trackedMarkerIcon
                ? { backgroundImage: `url("${trackedMarkerIcon}")` }
                : {}),
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
