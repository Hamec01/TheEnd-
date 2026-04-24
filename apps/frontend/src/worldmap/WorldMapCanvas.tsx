import { useEffect, useRef, useState } from 'react';
import '../styles.css';

const REGION_GRID_COLUMNS = 45;
const REGION_GRID_ROWS = 34;

const GRID_HORIZONTAL_OFFSET = 0;
const GRID_VERTICAL_OFFSET = 0;

const REGION_LABELS: Record<number, string> = {
  1: 'Сольеймaр',
  2: 'Сольеймaр',
  3: 'Сольеймaр',
  4: 'Сольеймaр',
  5: 'Сольеймaр',
  6: 'Сольеймaр',
  7: 'Сольеймaр',
  8: 'Сольеймaр',
  9: 'Сольеймaр',
  10: 'Сольеймaр',
  11: 'Сольеймaр',
  12: 'Сольеймaр',
};

const LOCATION_HOTSPOTS = [
  { id: 'arklein', x: 0.56, y: 0.86, radius: 0.085 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getGridMetrics(width: number, height: number) {
  // Exact isometric transform for CxR grid that spans the full canvas with zero offsets.
  const diagonalCount = Math.max(1, REGION_GRID_COLUMNS + REGION_GRID_ROWS - 2);
  const halfWidth = width / diagonalCount;
  const halfHeight = height / diagonalCount;
  const originX = ((REGION_GRID_ROWS - 1) * halfWidth) + GRID_HORIZONTAL_OFFSET;
  const originY = GRID_VERTICAL_OFFSET;

  return {
    originX,
    originY,
    halfWidth,
    halfHeight,
  };
}

function getGridCenter(column: number, row: number, width: number, height: number) {
  const {
    halfWidth,
    halfHeight,
    originX,
    originY,
  } = getGridMetrics(width, height);

  return {
    x: originX + (column - row) * halfWidth,
    y: originY + (column + row) * halfHeight,
    halfWidth,
    halfHeight,
  };
}

function snapToGrid(x: number, y: number, width: number, height: number) {
  let nearestColumn = 0;
  let nearestRow = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let column = 0; column < REGION_GRID_COLUMNS; column += 1) {
    for (let row = 0; row < REGION_GRID_ROWS; row += 1) {
      const center = getGridCenter(column, row, width, height);
      const deltaX = center.x - x;
      const deltaY = center.y - y;
      const distance = (deltaX * deltaX) + (deltaY * deltaY);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestColumn = column;
        nearestRow = row;
      }
    }
  }

  return { column: nearestColumn, row: nearestRow };
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
) {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfHeight);
  ctx.lineTo(centerX + halfWidth, centerY);
  ctx.lineTo(centerX, centerY + halfHeight);
  ctx.lineTo(centerX - halfWidth, centerY);
  ctx.closePath();
}

interface WorldMapCanvasProps {
  onOpenLocation?: (locationId: string) => void;
}

export function WorldMapCanvas(props: WorldMapCanvasProps) {
  const { onOpenLocation } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [playerPos, setPlayerPos] = useState<{ column: number; row: number }>({ column: 22, row: 17 });
  const [currentRegionId, setCurrentRegionId] = useState(5);
  const [regionImage, setRegionImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 920, height: 736 });

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return undefined;
    }

    const resizeCanvas = () => {
      const availableWidth = Math.max(320, surface.clientWidth - 16);
      const availableHeight = Math.max(320, surface.clientHeight - 20);
      const aspectRatio = regionImage ? (regionImage.naturalWidth / regionImage.naturalHeight) : (5 / 4);

      let width = availableWidth;
      let height = Math.round(width / aspectRatio);

      if (height > availableHeight) {
        height = availableHeight;
        width = Math.round(height * aspectRatio);
      }

      setCanvasSize({ width, height });
    };

    resizeCanvas();

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });

    observer.observe(surface);
    return () => observer.disconnect();
  }, [regionImage]);

  useEffect(() => {
    const img = new Image();
    img.src = `/map/${currentRegionId}.${currentRegionId === 1 ? 'png' : 'gif'}`;
    img.onload = () => {
      setRegionImage(img);
    };
    img.onerror = () => {
      console.warn(`Failed to load map region ${currentRegionId}`);
    };
  }, [currentRegionId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    setPlayerPos(snapToGrid(clickX, clickY, canvas.width, canvas.height));
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width;
    const normalizedY = (e.clientY - rect.top) / rect.height;

    const hotspot = LOCATION_HOTSPOTS.find((location) => {
      const deltaX = normalizedX - location.x;
      const deltaY = normalizedY - location.y;
      return Math.hypot(deltaX, deltaY) <= location.radius;
    });

    if (hotspot) {
      onOpenLocation?.(hotspot.id);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !regionImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(regionImage, 0, 0, canvas.width, canvas.height);

    const gridCenter = getGridCenter(playerPos.column, playerPos.row, canvas.width, canvas.height);
    drawDiamond(ctx, gridCenter.x, gridCenter.y, gridCenter.halfWidth, gridCenter.halfHeight);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.18)';
    ctx.fill();

    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.fillStyle = '#ffcc00';
    ctx.arc(gridCenter.x, gridCenter.y, Math.max(12, canvas.width * 0.022), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff7d1';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [canvasSize.height, canvasSize.width, playerPos, regionImage]);

  return (
    <section className="wm-map card">
      <div className="wm-map-surface" ref={surfaceRef}>
        <div className="wm-map-title">{REGION_LABELS[currentRegionId]} (Регион {currentRegionId})</div>

        <div className="wm-map-tile-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 8px 8px' }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              maxWidth: '100%',
              maxHeight: '100%',
              border: '1px solid rgba(50, 38, 24, 0.95)',
              backgroundColor: '#000',
              display: 'block',
              cursor: 'crosshair',
              imageRendering: 'auto',
            } as React.CSSProperties}
          />
        </div>
      </div>

      <footer className="wm-map-legend">
        <span>Клетка: ({playerPos.column}, {playerPos.row}) | Сетка: {REGION_GRID_COLUMNS}x{REGION_GRID_ROWS} | Регион {currentRegionId} | Двойной клик по Арклейну открывает город</span>
      </footer>
    </section>
  );
}
