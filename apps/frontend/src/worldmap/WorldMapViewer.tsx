import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type SyntheticEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { QuestMarkerDefinition } from '../types/quest';
import type { PlayerQuestState } from '../types/quest';
import { WORLD_MAP_EXPLORATION_GRID_SIZE, getExplorationCellKeyFromPosition } from './worldMapExploration';

interface WorldMapViewerProps {
  isOpen: boolean;
  mapImagePath: string;
  fallbackMapImagePath?: string;
  playerPosition: { x: number; y: number };
  discoveredCells?: string[];
  questMarkers?: QuestMarkerDefinition[];
  playerQuestStates?: PlayerQuestState[];
  trackedMarkerId?: string | null;
  trackedQuestId?: string | null;
  trackedObjectiveId?: string | null;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function WorldMapViewer({
  isOpen,
  mapImagePath,
  fallbackMapImagePath,
  playerPosition,
  discoveredCells = [],
  questMarkers = [],
  playerQuestStates = [],
  trackedMarkerId = null,
  trackedQuestId = null,
  trackedObjectiveId = null,
  onClose,
}: WorldMapViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeImagePath, setActiveImagePath] = useState(mapImagePath);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const discoveredSet = useMemo(() => new Set(discoveredCells), [discoveredCells]);
  const hiddenFogCells = useMemo(() => {
    const cells: Array<{ key: string; x: number; y: number }> = [];

    for (let y = 0; y < WORLD_MAP_EXPLORATION_GRID_SIZE; y += 1) {
      for (let x = 0; x < WORLD_MAP_EXPLORATION_GRID_SIZE; x += 1) {
        const key = `${x}:${y}`;
        if (discoveredSet.has(key)) {
          continue;
        }

        cells.push({ key, x, y });
      }
    }

    return cells;
  }, [discoveredSet]);

  const questStateByQuestId = useMemo(() => {
    const map = new Map<string, PlayerQuestState>();
    for (const state of playerQuestStates) {
      if (!state?.questId) {
        continue;
      }
      map.set(state.questId, state);
    }
    return map;
  }, [playerQuestStates]);

  const visibleViewerMarkers = useMemo(() => {
    return questMarkers
      .filter((marker) => marker.mapId === 'worldmap-main')
      .filter((marker) => marker.showOnMiniMap !== false)
      .filter((marker) => {
        const linkedQuestId = (marker.linkedQuestId ?? '').trim();
        const state = linkedQuestId ? questStateByQuestId.get(linkedQuestId) ?? null : null;
        if (state && (state.status === 'completed' || state.status === 'failed')) {
          return false;
        }

        const markerObjectiveId = String(marker.linkedObjectiveId ?? marker.objectiveId ?? '').trim();
        if (state && markerObjectiveId && state.completedObjectiveIds.includes(markerObjectiveId)) {
          return false;
        }

        const visibility = marker.miniMapVisibility ?? 'always';
        if (visibility === 'hidden') {
          return false;
        }

        const isDiscovered = discoveredSet.has(getExplorationCellKeyFromPosition(marker.x, marker.y));
        if (visibility === 'discoveredOnly' && !isDiscovered) {
          return false;
        }

        if (visibility === 'selectedQuestOnly') {
          if (!trackedQuestId) {
            return false;
          }

          const markerQuestId = (marker.linkedQuestId ?? '').trim();
          if (markerQuestId !== trackedQuestId) {
            return false;
          }

          if (trackedObjectiveId) {
            const markerObjectiveId = String(
              marker.linkedObjectiveId ?? marker.objectiveId ?? '',
            ).trim();
            if (markerObjectiveId && markerObjectiveId !== trackedObjectiveId) {
              return false;
            }
          }
        }

        return true;
      });
  }, [discoveredSet, questMarkers, questStateByQuestId, trackedObjectiveId, trackedQuestId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveImagePath(mapImagePath);
    setImageLoaded(false);
  }, [isOpen, mapImagePath]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resize = () => {
      setViewportSize({
        width: Math.max(1, Math.floor(container.clientWidth)),
        height: Math.max(1, Math.floor(container.clientHeight)),
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isOpen]);

  const scaledSize = useMemo(() => {
    return {
      width: imageNaturalSize.width * zoom,
      height: imageNaturalSize.height * zoom,
    };
  }, [imageNaturalSize.height, imageNaturalSize.width, zoom]);

  const clampPan = useCallback((nextX: number, nextY: number) => {
    const minX = Math.min(0, viewportSize.width - scaledSize.width);
    const minY = Math.min(0, viewportSize.height - scaledSize.height);
    return {
      x: clamp(nextX, minX, 0),
      y: clamp(nextY, minY, 0),
    };
  }, [scaledSize.height, scaledSize.width, viewportSize.height, viewportSize.width]);

  const centerOnPlayer = useCallback(() => {
    const centerX = playerPosition.x * scaledSize.width;
    const centerY = playerPosition.y * scaledSize.height;
    const desiredPanX = viewportSize.width / 2 - centerX;
    const desiredPanY = viewportSize.height / 2 - centerY;
    setPan(clampPan(desiredPanX, desiredPanY));
  }, [clampPan, playerPosition.x, playerPosition.y, scaledSize.height, scaledSize.width, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    if (!isOpen || !imageLoaded) {
      return;
    }

    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imageLoaded, isOpen]);

  useEffect(() => {
    if (!isOpen || !imageLoaded) {
      return;
    }

    centerOnPlayer();
  }, [centerOnPlayer, imageLoaded, isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const target = event.currentTarget;
    setImageNaturalSize({
      width: Math.max(1, target.naturalWidth),
      height: Math.max(1, target.naturalHeight),
    });
    setImageLoaded(true);
  }

  function handleImageError() {
    if (fallbackMapImagePath && activeImagePath !== fallbackMapImagePath) {
      setActiveImagePath(fallbackMapImagePath);
      return;
    }

    setImageLoaded(false);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!imageLoaded) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const mapX = (pointerX - pan.x) / scaledSize.width;
    const mapY = (pointerY - pan.y) / scaledSize.height;

    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
    const nextZoom = clamp(zoom * zoomFactor, 0.5, 5);
    const nextScaledWidth = imageNaturalSize.width * nextZoom;
    const nextScaledHeight = imageNaturalSize.height * nextZoom;

    const nextPanX = pointerX - mapX * nextScaledWidth;
    const nextPanY = pointerY - mapY * nextScaledHeight;

    setZoom(nextZoom);

    const minX = Math.min(0, viewportSize.width - nextScaledWidth);
    const minY = Math.min(0, viewportSize.height - nextScaledHeight);
    setPan({
      x: clamp(nextPanX, minX, 0),
      y: clamp(nextPanY, minY, 0),
    });
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (!imageLoaded || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  }

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!isDragging || !dragStart) {
      return;
    }

    event.preventDefault();
    const nextX = dragStart.panX + (event.clientX - dragStart.x);
    const nextY = dragStart.panY + (event.clientY - dragStart.y);
    setPan(clampPan(nextX, nextY));
  }

  function stopDragging() {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    setDragStart(null);
  }

  return (
    <div className="wm-viewer-backdrop" role="dialog" aria-modal="true" aria-label="World Map Viewer">
      <div className="wm-viewer card">
        <header className="wm-viewer-header">
          <h3>Карта мира</h3>
          <div className="wm-viewer-actions">
            <button type="button" onClick={centerOnPlayer}>К себе</button>
            <button type="button" onClick={onClose}>Закрыть</button>
          </div>
        </header>
        <div
          ref={containerRef}
          className={`wm-viewer-canvas ${isDragging ? 'is-dragging' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
        >
          <div
            className="wm-viewer-stage"
            style={{
              width: `${scaledSize.width}px`,
              height: `${scaledSize.height}px`,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            <img
              src={activeImagePath}
              alt="World map"
              className="wm-viewer-image"
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {imageLoaded ? (
              <>
                {visibleViewerMarkers.map((marker) => (
                    <span
                      key={marker.id}
                      className={`wm-viewer-marker ${trackedMarkerId === marker.id ? 'is-tracked' : ''}`}
                      style={{
                        left: `${marker.x * 100}%`,
                        top: `${marker.y * 100}%`,
                      }}
                      title={marker.title || marker.id}
                    />
                  ))}
                {hiddenFogCells.map((cell) => (
                  <span
                    key={cell.key}
                    className="wm-viewer-fog-cell"
                    style={{
                      left: `${(cell.x / WORLD_MAP_EXPLORATION_GRID_SIZE) * 100}%`,
                      top: `${(cell.y / WORLD_MAP_EXPLORATION_GRID_SIZE) * 100}%`,
                      width: `${100 / WORLD_MAP_EXPLORATION_GRID_SIZE}%`,
                      height: `${100 / WORLD_MAP_EXPLORATION_GRID_SIZE}%`,
                    }}
                  />
                ))}
                <span
                  className="wm-viewer-player-marker"
                  style={{
                    left: `${playerPosition.x * 100}%`,
                    top: `${playerPosition.y * 100}%`,
                  }}
                  title="Игрок"
                />
              </>
            ) : null}
          </div>
        </div>
        <footer className="wm-viewer-footer muted">
          Колесо мыши: zoom. ЛКМ: двигать карту. Esc: закрыть.
        </footer>
      </div>
    </div>
  );
}
