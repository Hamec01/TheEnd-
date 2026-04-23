import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import '../styles.css';
const REGION_GRID_COLUMNS = 15;
const REGION_GRID_ROWS = 12;
const GRID_ORIGIN_X = 0.5;
const GRID_ORIGIN_Y = 0.09;
const GRID_HALF_WIDTH = 0.071;
const GRID_HALF_HEIGHT = 0.051;
const REGION_LABELS = {
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
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function getGridCenter(column, row, width, height) {
    const halfWidth = width * GRID_HALF_WIDTH;
    const halfHeight = height * GRID_HALF_HEIGHT;
    const originX = width * GRID_ORIGIN_X;
    const originY = height * GRID_ORIGIN_Y;
    return {
        x: originX + (column - row) * halfWidth,
        y: originY + (column + row) * halfHeight,
        halfWidth,
        halfHeight,
    };
}
function snapToGrid(x, y, width, height) {
    const halfWidth = width * GRID_HALF_WIDTH;
    const halfHeight = height * GRID_HALF_HEIGHT;
    const originX = width * GRID_ORIGIN_X;
    const originY = height * GRID_ORIGIN_Y;
    const normalizedX = (x - originX) / halfWidth;
    const normalizedY = (y - originY) / halfHeight;
    const column = clamp(Math.round((normalizedY + normalizedX) / 2), 0, REGION_GRID_COLUMNS - 1);
    const row = clamp(Math.round((normalizedY - normalizedX) / 2), 0, REGION_GRID_ROWS - 1);
    return { column, row };
}
function drawDiamond(ctx, centerX, centerY, halfWidth, halfHeight) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - halfHeight);
    ctx.lineTo(centerX + halfWidth, centerY);
    ctx.lineTo(centerX, centerY + halfHeight);
    ctx.lineTo(centerX - halfWidth, centerY);
    ctx.closePath();
}
export function WorldMapCanvas(props) {
    const { onOpenLocation } = props;
    const canvasRef = useRef(null);
    const surfaceRef = useRef(null);
    const [playerPos, setPlayerPos] = useState({ column: 7, row: 6 });
    const [currentRegionId, setCurrentRegionId] = useState(5);
    const [regionImage, setRegionImage] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 920, height: 736 });
    useEffect(() => {
        const surface = surfaceRef.current;
        if (!surface) {
            return undefined;
        }
        const resizeCanvas = () => {
            const availableWidth = Math.max(320, surface.clientWidth - 16);
            const availableHeight = Math.max(320, surface.clientHeight - 20);
            const aspectRatio = 5 / 4;
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
    }, []);
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
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        setPlayerPos(snapToGrid(clickX, clickY, canvas.width, canvas.height));
    };
    const handleCanvasDoubleClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
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
        if (!canvas || !regionImage)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
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
    return (_jsxs("section", { className: "wm-map card", children: [_jsxs("div", { className: "wm-map-surface", ref: surfaceRef, children: [_jsxs("div", { className: "wm-map-title", children: [REGION_LABELS[currentRegionId], " (\u0420\u0435\u0433\u0438\u043E\u043D ", currentRegionId, ")"] }), _jsx("div", { className: "wm-map-tile-container", style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 8px 8px' }, children: _jsx("canvas", { ref: canvasRef, onClick: handleCanvasClick, onDoubleClick: handleCanvasDoubleClick, style: {
                                width: `${canvasSize.width}px`,
                                height: `${canvasSize.height}px`,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                border: '1px solid rgba(50, 38, 24, 0.95)',
                                backgroundColor: '#000',
                                display: 'block',
                                cursor: 'crosshair',
                                imageRendering: 'auto',
                            } }) })] }), _jsx("footer", { className: "wm-map-legend", children: _jsxs("span", { children: ["\u041A\u043B\u0435\u0442\u043A\u0430: (", playerPos.column, ", ", playerPos.row, ") | \u0420\u0435\u0433\u0438\u043E\u043D ", currentRegionId, " | \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u043A\u043B\u0438\u043A \u043F\u043E \u0410\u0440\u043A\u043B\u0435\u0439\u043D\u0443 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0433\u043E\u0440\u043E\u0434"] }) })] }));
}
