import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getContentSnapshot, type ContentSnapshot } from '../../services/content/contentApi';
import { useWorldSnapshot } from '../../services/useWorldSimulation';
import type { WorldSimulationSnapshot } from '../../types/world-simulation.types';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import './ActiveWorldEntities.css';

type ActiveEntity = WorldSimulationSnapshot['activeEntities'][number];
type DisplayEntity = ActiveEntity & { renderedCoordinates: { x: number; y: number } };

const SNAPSHOT_BLEND_DURATION_MS = 900;

function isMeaningfulPortraitId(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && normalized !== 'unknown' && normalized !== 'none' && normalized !== 'null');
}

function isPortraitMarker(entity: ActiveEntity): boolean {
  return entity.kind !== 'merchant' && isMeaningfulPortraitId(entity.portraitId);
}

export function ActiveWorldEntitiesLayer({
  camera,
  onEntityClick,
}: {
  camera: { left: number; top: number; width: number; height: number };
  onEntityClick: (entity: ActiveEntity) => void;
}) {
  const { snapshot, loading } = useWorldSnapshot();
  const [runtimeImages, setRuntimeImages] = useState<any[]>([]);
  const [contentSnapshot, setContentSnapshot] = useState<ContentSnapshot | null>(null);
  const [displayEntities, setDisplayEntities] = useState<DisplayEntity[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const displayEntitiesRef = useRef<DisplayEntity[]>([]);

  useEffect(() => {
    let mounted = true;
    loadRuntimeImages()
      .then((images) => {
        if (mounted) {
          setRuntimeImages(images);
        }
      })
      .catch(() => {
        if (mounted) {
          setRuntimeImages([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getContentSnapshot()
      .then((content) => {
        if (mounted) {
          setContentSnapshot(content);
        }
      })
      .catch(() => {
        if (mounted) {
          setContentSnapshot(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleEntities = useMemo(
    () => (snapshot?.activeEntities ?? []) as ActiveEntity[],
    [snapshot],
  );

  const npcById = useMemo(() => {
    const entries = new Map<string, ContentSnapshot['npcs'][number]>();
    for (const npc of contentSnapshot?.npcs ?? []) {
      entries.set(npc.id, npc);
    }
    return entries;
  }, [contentSnapshot?.npcs]);

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
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SNAPSHOT_BLEND_DURATION_MS);
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

  const resolveEntitySpriteSource = (spriteId: string) => {
    const runtimeSprite = resolveStoredImageSource(spriteId, runtimeImages);
    if (runtimeSprite) {
      return runtimeSprite;
    }
    return spriteId.startsWith('/') ? spriteId : `/sprites/world/${spriteId}.png`;
  };

  const resolveEntityPortraitSource = (portraitId?: string, npcTemplateId?: string) => {
    if (isMeaningfulPortraitId(portraitId)) {
      const runtimePortrait = resolveStoredImageSource(portraitId, runtimeImages);
      if (runtimePortrait) {
        return runtimePortrait;
      }
      if (portraitId?.startsWith('/')) {
        return portraitId;
      }
      if (portraitId?.startsWith('http://') || portraitId?.startsWith('https://') || portraitId?.startsWith('data:')) {
        return portraitId;
      }
      const withExtension = portraitId?.includes('.') ? portraitId : `${portraitId}.png`;
      return `/sprites/actor/${withExtension}`;
    }

    const npc = npcTemplateId ? npcById.get(npcTemplateId) : undefined;
    const npcPortrait = npc
      ? resolveStoredImageSource(npc.fullImageUrl, runtimeImages)
        ?? resolveStoredImageSource(npc.portraitUrl, runtimeImages)
        ?? resolveStoredImageSource(npc.iconUrl, runtimeImages)
        ?? npc.fullImageUrl?.trim()
        ?? npc.portraitUrl?.trim()
        ?? npc.iconUrl?.trim()
      : undefined;

    if (!npcPortrait) {
      return undefined;
    }

    return npcPortrait;
  };

  if (loading) {
    return null;
  }

  return (
    <div className="active-world-entities-layer">
      {displayEntities.map((entity) => {
        const screenX = (entity.renderedCoordinates.x - camera.left) / camera.width;
        const screenY = (entity.renderedCoordinates.y - camera.top) / camera.height;
        if (screenX < -0.05 || screenX > 1.05 || screenY < -0.05 || screenY > 1.05) {
          return null;
        }

        const portraitSrc = resolveEntityPortraitSource(entity.portraitId, entity.npcTemplateId);
        const portraitMarker = entity.kind !== 'merchant' && Boolean(portraitSrc);
        const spriteSrc = resolveEntitySpriteSource(entity.spriteId);

        return (
          <div
            key={entity.id}
            className={`world-entity ${portraitMarker ? 'is-portrait-marker' : `sprite-${entity.spriteId}`} ${entity.state} ${entity.isHostile ? 'hostile' : 'friendly'}`}
            style={{
              left: `${screenX * 100}%`,
              top: `${screenY * 100}%`,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEntityClick(entity);
            }}
            title={`${entity.archetypeId} (${entity.state})`}
          >
            {portraitMarker && portraitSrc ? (
              <div
                className="entity-portrait-marker"
                style={{ backgroundImage: `url(${portraitSrc})` }}
              />
            ) : (
              <img
                src={spriteSrc}
                alt={entity.archetypeId}
                className="entity-sprite"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
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
