import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WorldSimulationSnapshot } from '../../types/world-simulation.types';
import type { RenderedWorldEntity } from '../worldSceneTypes';
import './ActiveWorldEntities.css';

type ActiveEntity = WorldSimulationSnapshot['activeEntities'][number];
type DisplayEntity = RenderedWorldEntity & { renderedCoordinates: { x: number; y: number } };

const SNAPSHOT_BLEND_MIN_MS = 120;
const SNAPSHOT_BLEND_MAX_MS = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ActiveWorldEntitiesLayer({
  camera,
  worldSnapshot,
  renderedEntities,
  lockedEntity,
}: {
  camera: { left: number; top: number; width: number; height: number };
  worldSnapshot: WorldSimulationSnapshot | null;
  renderedEntities: RenderedWorldEntity[];
  lockedEntity?: { id: string; coordinates: { x: number; y: number } } | null;
}) {
  const [displayEntities, setDisplayEntities] = useState<DisplayEntity[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const displayEntitiesRef = useRef<DisplayEntity[]>([]);
  const lastSnapshotAppliedAtRef = useRef<number | null>(null);

  const visibleEntities = useMemo(
    () => renderedEntities,
    [renderedEntities],
  );
  const rawEntityById = useMemo(() => {
    const entries = new Map<string, ActiveEntity>();
    for (const entity of worldSnapshot?.activeEntities ?? []) {
      entries.set(entity.id, entity);
    }
    return entries;
  }, [worldSnapshot?.activeEntities]);

  useEffect(() => {
    displayEntitiesRef.current = displayEntities;
  }, [displayEntities]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (visibleEntities.length === 0) {
      setDisplayEntities([]);
      return;
    }

    const previousById = new Map(
      displayEntitiesRef.current.map((entity) => [entity.id, entity]),
    );
    const now = performance.now();
    const observedIntervalMs = lastSnapshotAppliedAtRef.current === null
      ? SNAPSHOT_BLEND_MAX_MS
      : now - lastSnapshotAppliedAtRef.current;
    lastSnapshotAppliedAtRef.current = now;

    const blendDurationMs = clamp(observedIntervalMs * 0.9, SNAPSHOT_BLEND_MIN_MS, SNAPSHOT_BLEND_MAX_MS);
    const startedAt = now;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / blendDurationMs);
      const nextEntities: DisplayEntity[] = visibleEntities.map((entity) => {
        const previous = previousById.get(entity.id);
        const fromX = previous?.renderedCoordinates.x ?? entity.coordinates.x;
        const fromY = previous?.renderedCoordinates.y ?? entity.coordinates.y;
        return {
          ...entity,
          renderedCoordinates: {
            x: fromX + (entity.coordinates.x - fromX) * progress,
            y: fromY + (entity.coordinates.y - fromY) * progress,
          },
        };
      });

      setDisplayEntities(nextEntities);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visibleEntities]);

  if (!worldSnapshot) {
    return null;
  }

  return (
    <div className="active-world-entities-layer">
      {displayEntities.map((entity) => {
        const renderCoordinates = lockedEntity?.id === entity.id
          ? lockedEntity.coordinates
          : entity.renderedCoordinates;

        const screenX = (renderCoordinates.x - camera.left) / camera.width;
        const screenY = (renderCoordinates.y - camera.top) / camera.height;
        if (screenX < -0.05 || screenX > 1.05 || screenY < -0.05 || screenY > 1.05) {
          return null;
        }

        const portraitSrc = entity.portraitSrc;
        const portraitMarker = entity.renderMode === 'portrait' && Boolean(portraitSrc);
        const spriteSrc = entity.spriteSrc;
        const rawEntity = rawEntityById.get(entity.id);
        if (!rawEntity) {
          return null;
        }

        return (
          <div
            key={entity.id}
            className={`world-entity ${portraitMarker ? 'is-portrait-marker' : `sprite-${entity.spriteId}`} ${entity.state} ${entity.isHostile ? 'hostile' : 'friendly'}`}
            style={{
              left: `${screenX * 100}%`,
              top: `${screenY * 100}%`,
            }}
            title={entity.title}
          >
            {portraitMarker && portraitSrc ? (
              <div
                className="entity-portrait-marker"
                style={{ backgroundImage: `url(${portraitSrc})` }}
              />
            ) : spriteSrc ? (
              <img
                src={spriteSrc}
                alt={entity.label}
                className="entity-sprite"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="entity-portrait-marker" />
            )}

            {portraitSrc ? (
              <div className="entity-portrait-hover">
                <img
                  src={portraitSrc}
                  alt="Portrait"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : null}

            {entity.memberCount > 1 ? (
              <div className="group-count-indicator">{entity.memberCount}</div>
            ) : null}
            {entity.isHostile ? <div className="hostile-indicator">!</div> : null}
            {entity.hasQuest ? <div className="quest-indicator">?</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export default ActiveWorldEntitiesLayer;
