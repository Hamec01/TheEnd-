import { BATTLEFIELD_GRID_SIZE } from '@theend/rpg-domain';
import { useMemo, useState } from 'react';

export interface ArenaBlockedTile {
  x: number;
  y: number;
}

interface ArenaMapEditorProps {
  mapImageUrl: string;
  blockedTiles: ArenaBlockedTile[];
  onMapImageUrlChange: (value: string) => void;
  onBlockedTilesChange: (tiles: ArenaBlockedTile[]) => void;
}

type PaintMode = 'block' | 'walk';

function toKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function ArenaMapEditor({
  mapImageUrl,
  blockedTiles,
  onMapImageUrlChange,
  onBlockedTilesChange,
}: ArenaMapEditorProps) {
  const [paintMode, setPaintMode] = useState<PaintMode>('block');
  const [isPainting, setIsPainting] = useState(false);

  const blockedSet = useMemo(() => new Set(blockedTiles.map((tile) => toKey(tile.x, tile.y))), [blockedTiles]);

  const applyTile = (x: number, y: number) => {
    const key = toKey(x, y);
    const next = new Set(blockedSet);
    if (paintMode === 'block') {
      next.add(key);
    } else {
      next.delete(key);
    }

    const normalized: ArenaBlockedTile[] = [...next].map((entry) => {
      const [tileX, tileY] = entry.split(':').map(Number);
      return { x: tileX, y: tileY };
    });

    onBlockedTilesChange(normalized);
  };

  const handleUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        onMapImageUrlChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="inner-card arena-map-editor">
      <div className="arena-map-editor-head">
        <h3>Редактор арены</h3>
        <p className="muted">Загрузите карту и разметьте непроходимые клетки. Эти же клетки блокируют и прострел.</p>
      </div>

      <div className="row">
        <label>URL карты</label>
        <input
          value={mapImageUrl}
          placeholder="/map/battle-map_arena.png"
          onChange={(event) => onMapImageUrlChange(event.target.value)}
        />
      </div>

      <div className="row">
        <label>Загрузить картинку</label>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="arena-map-editor-toolbar">
        <button
          type="button"
          className={paintMode === 'block' ? 'is-active' : ''}
          onClick={() => setPaintMode('block')}
        >
          Рисовать стены
        </button>
        <button
          type="button"
          className={paintMode === 'walk' ? 'is-active' : ''}
          onClick={() => setPaintMode('walk')}
        >
          Стирать стены
        </button>
        <button
          type="button"
          onClick={() => onBlockedTilesChange([])}
        >
          Очистить всё
        </button>
      </div>

      <div
        className="arena-map-editor-board"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(9, 8, 7, 0.32), rgba(8, 6, 5, 0.4)), url('${mapImageUrl || '/map/battle-map_arena.png'}')`,
        }}
        onMouseUp={() => setIsPainting(false)}
        onMouseLeave={() => setIsPainting(false)}
      >
        {Array.from({ length: BATTLEFIELD_GRID_SIZE * BATTLEFIELD_GRID_SIZE }, (_, index) => {
          const x = index % BATTLEFIELD_GRID_SIZE;
          const y = Math.floor(index / BATTLEFIELD_GRID_SIZE);
          const isBlocked = blockedSet.has(toKey(x, y));

          return (
            <button
              key={`editor-tile-${x}-${y}`}
              type="button"
              className={`arena-map-editor-tile ${isBlocked ? 'is-blocked' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                setIsPainting(true);
                applyTile(x, y);
              }}
              onMouseEnter={() => {
                if (isPainting) {
                  applyTile(x, y);
                }
              }}
              title={`${x + 1}:${y + 1}${isBlocked ? ' blocked' : ' walkable'}`}
            />
          );
        })}
      </div>

      <p className="muted">Непроходимых клеток: {blockedTiles.length}</p>
    </section>
  );
}
