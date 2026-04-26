import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, } from 'react';
import '../styles.css';
import { tickPlayerMovement, setPlayerTarget } from './movementSystem';
import { detectCurrentZone, detectHoverZone, isInsideZone } from './zoneSystem';
import { WORLD_MAP_ZONES } from './worldMapNodes';
import { ZONE_COLORS, EDITOR_DRAFT_ALPHA, EDITOR_FILL_ALPHA, EDITOR_STROKE_ALPHA, INVALID_DRAFT_COLOR, ZONE_DUNGEON_OUTLINE, withAlpha } from './zoneColors';
import { clamp, getZoneCenter, hitTestHandle, hitTestZones, mapNormalizedToScreen, movePolygonPoint, moveZone, resizeCircle, screenToMapNormalized } from './zoneGeometry';
import { createDraftFromZone, createEmptyZoneDraft } from './zoneEditorTypes';
import { REGION_GRID_SIZE, REGION_TYPE_COLORS, applyBrushAlongLine, applyRegionPaint, getPaintedRegionCellMap, mapPointToRegionCell } from './regionPaintSystem';
const PLAY_ZOOM = 5.2;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const OVERSCROLL = 120;
const PLAY_PLAYER = {
    x: 0.53,
    y: 0.83,
    targetX: null,
    targetY: null,
    speed: 0.0005,
};
function isFormElement(target) {
    return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
function cloneDraftWithGeometry(draft, zone) {
    if (!draft) {
        return createDraftFromZone(zone);
    }
    return {
        ...draft,
        shape: zone.shape,
        x: zone.x ?? null,
        y: zone.y ?? null,
        radius: zone.radius ?? null,
        points: zone.points ? zone.points.map((point) => [point[0], point[1]]) : [],
        selectedPointIndex: draft.selectedPointIndex ?? null,
        updatedAt: Date.now(),
    };
}
function polygonFromRect(start, end) {
    return [
        [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
        [Math.max(start[0], end[0]), Math.min(start[1], end[1])],
        [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
        [Math.min(start[0], end[0]), Math.max(start[1], end[1])],
    ];
}
function getClampedPan(zoom, panX, panY, canvasWidth, canvasHeight, imageWidth, imageHeight) {
    const scaledWidth = imageWidth * zoom;
    const scaledHeight = imageHeight * zoom;
    const minPanX = canvasWidth - scaledWidth - OVERSCROLL;
    const maxPanX = OVERSCROLL;
    const minPanY = canvasHeight - scaledHeight - OVERSCROLL;
    const maxPanY = OVERSCROLL;
    return {
        panX: clamp(panX, minPanX, maxPanX),
        panY: clamp(panY, minPanY, maxPanY),
    };
}
function getFitView(canvasWidth, canvasHeight, imageWidth, imageHeight) {
    const zoom = clamp(Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight), MIN_ZOOM, MAX_ZOOM);
    const panX = (canvasWidth - imageWidth * zoom) / 2;
    const panY = (canvasHeight - imageHeight * zoom) / 2;
    return { zoom, panX, panY };
}
function drawZoneShape(ctx, zone, viewport) {
    if (zone.shape === 'circle') {
        const [x, y] = mapNormalizedToScreen(zone.x ?? 0, zone.y ?? 0, viewport);
        const radius = (zone.radius ?? 0.03) * viewport.imageWidth * viewport.zoom;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        return;
    }
    const points = zone.points ?? [];
    if (points.length === 0) {
        return;
    }
    ctx.beginPath();
    points.forEach(([x, y], index) => {
        const [screenX, screenY] = mapNormalizedToScreen(x, y, viewport);
        if (index === 0) {
            ctx.moveTo(screenX, screenY);
        }
        else {
            ctx.lineTo(screenX, screenY);
        }
    });
    ctx.closePath();
}
function drawZoneHandles(ctx, zone, viewport) {
    ctx.save();
    ctx.fillStyle = '#fff4d4';
    if (zone.shape === 'circle') {
        const [centerX, centerY] = mapNormalizedToScreen(zone.x ?? 0, zone.y ?? 0, viewport);
        const [radiusX, radiusY] = mapNormalizedToScreen((zone.x ?? 0) + (zone.radius ?? 0), zone.y ?? 0, viewport);
        for (const [x, y] of [[centerX, centerY], [radiusX, radiusY]]) {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    else {
        (zone.points ?? []).forEach(([x, y]) => {
            const [screenX, screenY] = mapNormalizedToScreen(x, y, viewport);
            ctx.beginPath();
            ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    ctx.restore();
}
export const WorldMapCanvas = forwardRef(function WorldMapCanvas(props, ref) {
    const { mode, playerStartPosition, zones = WORLD_MAP_ZONES, selectedZoneId = null, selectedTool = 'select', settings, draft = null, onSettingsChange, onDraftChange, onZonesChange, onSelectZone, onCheckpoint, onDeleteZone, onDuplicateZone, onToggleZoneVisibility, onCopyJson, onPasteZoneAt, onConfirmDraft, onUndo, onRedo, onSaveShortcut, onToolChange, onStatusMessage, onMouseCoordinatesChange, regions = [], regionPaintSettings, onRegionsChange, onRegionCheckpoint, onOpenLocation, onEnterZone, onHoverZone, onPlayerPosition, onPlayerState, } = props;
    const canvasRef = useRef(null);
    const surfaceRef = useRef(null);
    const prevZoneRef = useRef(null);
    const playerStateRef = useRef('idle');
    const [worldImage, setWorldImage] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 780 });
    const [player, setPlayer] = useState(() => ({
        ...PLAY_PLAYER,
        x: clamp(playerStartPosition?.x ?? PLAY_PLAYER.x, 0, 1),
        y: clamp(playerStartPosition?.y ?? PLAY_PLAYER.y, 0, 1),
    }));
    const [hoverZone, setHoverZone] = useState(null);
    const [currentZone, setCurrentZone] = useState(null);
    const [tooltip, setTooltip] = useState(null);
    const [dragState, setDragState] = useState(null);
    const [cursorPoint, setCursorPoint] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [spacePressed, setSpacePressed] = useState(false);
    const [didInitialFit, setDidInitialFit] = useState(false);
    const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [selectedZoneId, zones]);
    const editorSettings = settings ?? {
        showZones: true,
        showLabels: true,
        showGrid: false,
        snapEnabled: false,
        selectedTool,
        zoom: 1,
        panX: 0,
        panY: 0,
    };
    const effectiveRegionPaintSettings = regionPaintSettings ?? {
        toolMode: 'circle',
        regionType: 'blocked',
        brushSize: 1,
    };
    const paintedCellMap = useMemo(() => getPaintedRegionCellMap(regions), [regions]);
    const editorViewport = useMemo(() => {
        if (!worldImage) {
            return null;
        }
        const clamped = getClampedPan(editorSettings.zoom, editorSettings.panX, editorSettings.panY, canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
        return {
            zoom: editorSettings.zoom,
            panX: clamped.panX,
            panY: clamped.panY,
            width: canvasSize.width,
            height: canvasSize.height,
            imageWidth: worldImage.naturalWidth,
            imageHeight: worldImage.naturalHeight,
        };
    }, [canvasSize.height, canvasSize.width, editorSettings.panX, editorSettings.panY, editorSettings.zoom, worldImage]);
    function focusZoneInView(zoneId) {
        if (!zoneId || !editorViewport) {
            return;
        }
        const zone = zones.find((entry) => entry.id === zoneId);
        if (!zone) {
            return;
        }
        const [centerX, centerY] = getZoneCenter(zone);
        const panX = canvasSize.width / 2 - centerX * editorViewport.imageWidth * editorSettings.zoom;
        const panY = canvasSize.height / 2 - centerY * editorViewport.imageHeight * editorSettings.zoom;
        const clamped = getClampedPan(editorSettings.zoom, panX, panY, canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
        onSettingsChange?.(clamped);
        onStatusMessage?.(`Editor: focus ${zone.name}.`);
    }
    useImperativeHandle(ref, () => ({
        resetView() {
            if (!worldImage) {
                return;
            }
            const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
            onSettingsChange?.(fit);
        },
        fitToScreen() {
            if (!worldImage) {
                return;
            }
            const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
            onSettingsChange?.(fit);
            onStatusMessage?.('Editor: fit map to screen.');
        },
        focusZone(zoneId) {
            focusZoneInView(zoneId);
        },
    }), [canvasSize.height, canvasSize.width, editorSettings.zoom, editorViewport, focusZoneInView, onSettingsChange, onStatusMessage, worldImage, zones]);
    useEffect(() => {
        const surface = surfaceRef.current;
        if (!surface) {
            return undefined;
        }
        const resize = () => {
            const nextWidth = Math.max(320, Math.floor(surface.clientWidth));
            const nextHeight = Math.max(mode === 'editor' ? 520 : 380, Math.floor(surface.clientHeight));
            setCanvasSize({ width: nextWidth, height: nextHeight });
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(surface);
        return () => observer.disconnect();
    }, [mode]);
    useEffect(() => {
        const image = new Image();
        image.src = '/map/world-map.png';
        image.onload = () => setWorldImage(image);
        image.onerror = () => {
            const fallback = new Image();
            fallback.src = '/map/1.png';
            fallback.onload = () => setWorldImage(fallback);
        };
    }, []);
    useEffect(() => {
        if (mode !== 'editor' || !worldImage || didInitialFit) {
            return;
        }
        const isDefaultView = settings ? settings.zoom === 1 && settings.panX === 0 && settings.panY === 0 : true;
        if (isDefaultView) {
            const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
            onSettingsChange?.(fit);
        }
        setDidInitialFit(true);
    }, [canvasSize.height, canvasSize.width, didInitialFit, mode, onSettingsChange, settings, worldImage]);
    useEffect(() => {
        if (mode !== 'play') {
            return undefined;
        }
        let frameId = 0;
        const animate = () => {
            setPlayer((prev) => {
                const tick = tickPlayerMovement(prev, 0.0012, (x, y) => {
                    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
                    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
                    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
                    if (!cell) {
                        return true;
                    }
                    return cell.regionType !== 'blocked' && cell.regionType !== 'water';
                });
                const enteredZone = detectCurrentZone(zones, tick.player.x, tick.player.y);
                playerStateRef.current = tick.state;
                setCurrentZone(enteredZone);
                return tick.player;
            });
            frameId = window.requestAnimationFrame(animate);
        };
        frameId = window.requestAnimationFrame(animate);
        return () => window.cancelAnimationFrame(frameId);
    }, [mode, paintedCellMap, zones]);
    // Separate effect to handle callbacks when player position or zone changes
    useEffect(() => {
        if (mode !== 'play') {
            return;
        }
        onPlayerPosition?.(player.x, player.y);
    }, [mode, player.x, player.y, onPlayerPosition]);
    // Separate effect to handle player state callbacks - combines movement state with zone state
    useEffect(() => {
        if (mode !== 'play') {
            return;
        }
        let state = 'idle';
        // Priority: moving > in_city > in_zone > idle
        if (playerStateRef.current === 'moving') {
            state = 'moving';
        }
        else if (currentZone?.type === 'city') {
            state = 'in_city';
        }
        else if (currentZone) {
            state = 'in_zone';
        }
        else {
            state = 'idle';
        }
        onPlayerState?.(state);
    }, [mode, currentZone, player.x, player.y, onPlayerState]);
    useEffect(() => {
        if (mode !== 'play' || !playerStartPosition) {
            return;
        }
        setPlayer((prev) => ({
            ...prev,
            x: clamp(playerStartPosition.x, 0, 1),
            y: clamp(playerStartPosition.y, 0, 1),
            targetX: null,
            targetY: null,
        }));
    }, [mode, playerStartPosition?.x, playerStartPosition?.y]);
    useEffect(() => {
        if (mode !== 'play') {
            return;
        }
        // Only call onEnterZone if zone actually changed
        if (currentZone?.id !== prevZoneRef.current?.id) {
            prevZoneRef.current = currentZone;
            onEnterZone?.(currentZone);
        }
    }, [currentZone, mode, onEnterZone]);
    useEffect(() => {
        if (mode !== 'editor') {
            return undefined;
        }
        const handleKeyDown = async (event) => {
            if (isFormElement(event.target) && !(event.ctrlKey || event.metaKey)) {
                if (!['Escape', 'Delete', 'Backspace'].includes(event.key)) {
                    return;
                }
            }
            if (event.key === ' ') {
                event.preventDefault();
                setSpacePressed(true);
                return;
            }
            if (event.key === '0') {
                event.preventDefault();
                if (!worldImage) {
                    return;
                }
                const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
                onSettingsChange?.(fit);
                return;
            }
            if (event.key.toLowerCase() === 'h') {
                event.preventDefault();
                if (!worldImage) {
                    return;
                }
                const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
                onSettingsChange?.(fit);
                return;
            }
            if (event.key.toLowerCase() === 'f') {
                event.preventDefault();
                if (selectedZoneId) {
                    focusZoneInView(selectedZoneId);
                }
                return;
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && selectedZoneId) {
                event.preventDefault();
                onDeleteZone?.(selectedZoneId);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                if (draft) {
                    onDraftChange?.(null);
                }
                else {
                    onSelectZone?.(null);
                }
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                onConfirmDraft?.();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                onSaveShortcut?.();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
                event.preventDefault();
                onCopyJson?.(selectedZone);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
                event.preventDefault();
                await onPasteZoneAt?.(cursorPoint ?? [0.5, 0.5]);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
                event.preventDefault();
                onRedo?.();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                onRedo?.();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                onUndo?.();
            }
        };
        const handleKeyUp = (event) => {
            if (event.key === ' ') {
                setSpacePressed(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [canvasSize.height, canvasSize.width, cursorPoint, draft, focusZoneInView, mode, onConfirmDraft, onCopyJson, onDeleteZone, onDraftChange, onPasteZoneAt, onRedo, onSaveShortcut, onSelectZone, onSettingsChange, onToolChange, onUndo, selectedZone, selectedZoneId, worldImage]);
    function updateZones(nextZones, nextSelectedZoneId = selectedZoneId) {
        onZonesChange?.(nextZones);
        if (nextSelectedZoneId) {
            const nextZone = nextZones.find((zone) => zone.id === nextSelectedZoneId) ?? null;
            if (nextZone) {
                onDraftChange?.(cloneDraftWithGeometry(draft, nextZone));
            }
        }
    }
    function paintRegionAlongLine(fromCell, toCell) {
        if (!onRegionsChange) {
            return;
        }
        const paintedCells = applyBrushAlongLine(fromCell, toCell, effectiveRegionPaintSettings.brushSize, effectiveRegionPaintSettings.toolMode);
        const nextRegions = applyRegionPaint(regions, paintedCells, effectiveRegionPaintSettings);
        onRegionsChange(nextRegions);
    }
    function getPlayCamera() {
        const width = 1 / PLAY_ZOOM;
        const height = 1 / PLAY_ZOOM;
        const left = clamp(player.x - width / 2, 0, 1 - width);
        const top = clamp(player.y - height / 2, 0, 1 - height);
        return { left, top, width, height };
    }
    function getCanvasPoint(event) {
        const canvas = canvasRef.current;
        if (!canvas) {
            return [0, 0];
        }
        const rect = canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    }
    function getNormalizedPoint(event) {
        const [canvasX, canvasY] = getCanvasPoint(event);
        if (mode === 'editor' && editorViewport) {
            return screenToMapNormalized(canvasX, canvasY, editorViewport);
        }
        const camera = getPlayCamera();
        return [
            clamp(camera.left + (canvasX / canvasSize.width) * camera.width, 0, 1),
            clamp(camera.top + (canvasY / canvasSize.height) * camera.height, 0, 1),
        ];
    }
    function zoomAt(canvasX, canvasY, nextZoom) {
        if (!editorViewport) {
            return;
        }
        const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        const [mapX, mapY] = screenToMapNormalized(canvasX, canvasY, editorViewport);
        const panX = canvasX - mapX * editorViewport.imageWidth * clampedZoom;
        const panY = canvasY - mapY * editorViewport.imageHeight * clampedZoom;
        const nextPan = getClampedPan(clampedZoom, panX, panY, canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
        onSettingsChange?.({ zoom: clampedZoom, panX: nextPan.panX, panY: nextPan.panY });
    }
    function handleEditorMouseDown(event) {
        if (!editorViewport) {
            return;
        }
        setContextMenu(null);
        const [canvasX, canvasY] = getCanvasPoint(event);
        const mapPoint = getNormalizedPoint(event);
        const hitZone = hitTestZones(zones, mapPoint);
        const wantsPan = event.button === 1 || (event.button === 0 && (spacePressed || selectedTool === 'pan'));
        if (wantsPan) {
            event.preventDefault();
            setDragState({ kind: 'pan', startX: canvasX, startY: canvasY, originPanX: editorSettings.panX, originPanY: editorSettings.panY });
            return;
        }
        if (event.button !== 0) {
            return;
        }
        if (selectedTool === 'select') {
            const handleHit = selectedZone ? hitTestHandle(selectedZone, mapPoint, editorViewport) : null;
            if (selectedZone && handleHit) {
                onCheckpoint?.();
                if (handleHit.type === 'center') {
                    setDragState({ kind: 'move-zone', zoneId: selectedZone.id, startPoint: mapPoint, originZone: selectedZone });
                }
                else if (handleHit.type === 'radius') {
                    setDragState({ kind: 'resize-circle', zoneId: selectedZone.id, originZone: selectedZone });
                }
                else if (handleHit.type === 'point' && handleHit.pointIndex !== undefined) {
                    onDraftChange?.({ ...(draft ?? createDraftFromZone(selectedZone)), selectedPointIndex: handleHit.pointIndex });
                    setDragState({ kind: 'move-point', zoneId: selectedZone.id, pointIndex: handleHit.pointIndex, originZone: selectedZone });
                }
                return;
            }
            if (hitZone) {
                if (selectedZoneId === hitZone.id) {
                    onCheckpoint?.();
                    setDragState({ kind: 'move-zone', zoneId: hitZone.id, startPoint: mapPoint, originZone: hitZone });
                }
                else {
                    onSelectZone?.(hitZone);
                }
                return;
            }
            const startCell = mapPointToRegionCell(mapPoint);
            onRegionCheckpoint?.();
            paintRegionAlongLine(startCell, startCell);
            setDragState({ kind: 'region-paint', lastCell: startCell });
            return;
        }
        if (selectedTool === 'measure') {
            setDragState({ kind: 'measure', start: mapPoint, current: mapPoint });
            return;
        }
        if (selectedTool === 'circle') {
            onSelectZone?.(null);
            const baseDraft = draft ? { ...draft, shape: 'circle', points: [], radius: draft.radius ?? 0.0025 } : createEmptyZoneDraft('circle');
            const nextDraft = {
                ...baseDraft,
                shape: 'circle',
                x: mapPoint[0],
                y: mapPoint[1],
                radius: 0.0025,
                points: [],
            };
            onDraftChange?.(nextDraft);
            setDragState({ kind: 'circle-draft', center: mapPoint });
            return;
        }
        if (selectedTool === 'rectangle') {
            onSelectZone?.(null);
            const baseDraft = draft ? { ...draft, shape: 'rect', x: null, y: null, radius: null } : createEmptyZoneDraft('rectangle');
            onDraftChange?.({ ...baseDraft, shape: 'rect', points: polygonFromRect(mapPoint, mapPoint) });
            setDragState({ kind: 'rect-draft', start: mapPoint });
            return;
        }
        if (selectedTool === 'polygon') {
            onCheckpoint?.();
            const currentDraft = draft?.shape === 'polygon' ? draft : createEmptyZoneDraft('polygon');
            onSelectZone?.(null);
            onDraftChange?.({
                ...currentDraft,
                shape: 'polygon',
                points: [...currentDraft.points, mapPoint],
                selectedPointIndex: currentDraft.points.length,
            });
            return;
        }
        const handleHit = selectedZone ? hitTestHandle(selectedZone, mapPoint, editorViewport) : null;
        if (selectedZone && handleHit) {
            onCheckpoint?.();
            if (handleHit.type === 'center') {
                setDragState({ kind: 'move-zone', zoneId: selectedZone.id, startPoint: mapPoint, originZone: selectedZone });
            }
            else if (handleHit.type === 'radius') {
                setDragState({ kind: 'resize-circle', zoneId: selectedZone.id, originZone: selectedZone });
            }
            else if (handleHit.type === 'point' && handleHit.pointIndex !== undefined) {
                onDraftChange?.({ ...(draft ?? createDraftFromZone(selectedZone)), selectedPointIndex: handleHit.pointIndex });
                setDragState({ kind: 'move-point', zoneId: selectedZone.id, pointIndex: handleHit.pointIndex, originZone: selectedZone });
            }
            return;
        }
        if (hitZone) {
            if (selectedZoneId === hitZone.id) {
                onCheckpoint?.();
                setDragState({ kind: 'move-zone', zoneId: hitZone.id, startPoint: mapPoint, originZone: hitZone });
            }
            else {
                onSelectZone?.(hitZone);
            }
            return;
        }
        onSelectZone?.(null);
        onDraftChange?.(null);
    }
    function handleMouseDown(event) {
        if (mode === 'editor') {
            handleEditorMouseDown(event);
            return;
        }
        if (event.button !== 0) {
            return;
        }
        const [x, y] = getNormalizedPoint(event);
        const clickedZone = detectHoverZone(zones, x, y);
        setPlayer((prev) => setPlayerTarget(prev, x, y));
        if (clickedZone?.type === 'city' && isInsideZone(clickedZone, x, y)) {
            onOpenLocation?.(clickedZone.id);
        }
    }
    function handleMouseMove(event) {
        const [canvasX, canvasY] = getCanvasPoint(event);
        const point = getNormalizedPoint(event);
        setCursorPoint(point);
        onMouseCoordinatesChange?.({ x: point[0], y: point[1] });
        if (mode === 'play') {
            const hovered = detectHoverZone(zones, point[0], point[1]);
            setHoverZone(hovered);
            onHoverZone?.(hovered);
            if (!hovered) {
                setTooltip(null);
                return;
            }
            setTooltip({ x: canvasX, y: canvasY, zone: hovered });
            return;
        }
        const hovered = hitTestZones(zones, point);
        setHoverZone(hovered);
        onHoverZone?.(hovered);
        if (hovered) {
            setTooltip({ x: canvasX, y: canvasY, zone: hovered });
        }
        else {
            setTooltip(null);
        }
        if (!dragState || !editorViewport) {
            return;
        }
        if (dragState.kind === 'pan') {
            const clamped = getClampedPan(editorSettings.zoom, dragState.originPanX + (canvasX - dragState.startX), dragState.originPanY + (canvasY - dragState.startY), canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
            onSettingsChange?.(clamped);
            return;
        }
        if (dragState.kind === 'region-paint') {
            const nextCell = mapPointToRegionCell(point);
            if (nextCell.x === dragState.lastCell.x && nextCell.y === dragState.lastCell.y) {
                return;
            }
            paintRegionAlongLine(dragState.lastCell, nextCell);
            setDragState({ kind: 'region-paint', lastCell: nextCell });
            return;
        }
        if (dragState.kind === 'move-zone') {
            const deltaX = point[0] - dragState.startPoint[0];
            const deltaY = point[1] - dragState.startPoint[1];
            const nextZone = moveZone(dragState.originZone, deltaX, deltaY);
            updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
            return;
        }
        if (dragState.kind === 'resize-circle') {
            const nextZone = resizeCircle(dragState.originZone, point);
            updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
            return;
        }
        if (dragState.kind === 'move-point') {
            const nextZone = movePolygonPoint(dragState.originZone, dragState.pointIndex, point);
            updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
            onDraftChange?.({ ...(draft ?? createDraftFromZone(nextZone)), selectedPointIndex: dragState.pointIndex, points: nextZone.points ? nextZone.points.map((entry) => [entry[0], entry[1]]) : [] });
            return;
        }
        if (dragState.kind === 'circle-draft') {
            const radius = Math.max(0.0025, Math.hypot(point[0] - dragState.center[0], point[1] - dragState.center[1]));
            const baseDraft = draft ?? createEmptyZoneDraft('circle');
            onDraftChange?.({ ...baseDraft, shape: 'circle', x: dragState.center[0], y: dragState.center[1], radius });
            return;
        }
        if (dragState.kind === 'rect-draft') {
            const baseDraft = draft ?? createEmptyZoneDraft('rectangle');
            onDraftChange?.({ ...baseDraft, shape: 'rect', points: polygonFromRect(dragState.start, point) });
            return;
        }
        if (dragState.kind === 'measure') {
            setDragState({ ...dragState, current: point });
        }
    }
    function handleMouseUp() {
        setDragState((current) => {
            if (current?.kind === 'circle-draft') {
                onStatusMessage?.('Draft circle created. Press Enter or Save New Zone.');
            }
            if (current?.kind === 'rect-draft') {
                onStatusMessage?.('Draft rectangle created. Press Enter or Save New Zone.');
            }
            return null;
        });
    }
    function handleDoubleClick() {
        if (mode !== 'editor') {
            return;
        }
        if (selectedTool === 'polygon' && draft?.shape === 'polygon' && draft.points.length >= 3) {
            onStatusMessage?.('Polygon draft finished. Press Enter or Save New Zone.');
        }
    }
    function handleMouseLeave() {
        setHoverZone(null);
        setTooltip(null);
        setContextMenu(null);
        setCursorPoint(null);
        onHoverZone?.(null);
        onMouseCoordinatesChange?.({ x: null, y: null });
    }
    async function handleContextMenu(event) {
        if (mode !== 'editor' || !editorViewport) {
            return;
        }
        event.preventDefault();
        const mapPoint = getNormalizedPoint(event);
        const zone = hitTestZones(zones, mapPoint);
        if (selectedTool === 'polygon' && draft?.shape === 'polygon' && draft.points.length > 0 && !zone) {
            onCheckpoint?.();
            onDraftChange?.({ ...draft, points: draft.points.slice(0, -1), selectedPointIndex: null });
            onStatusMessage?.('Polygon: removed last point.');
            return;
        }
        const [x, y] = getCanvasPoint(event);
        setContextMenu({ x, y, zone, mapPoint });
    }
    function handleWheel(event) {
        if (mode !== 'editor') {
            return;
        }
        event.preventDefault();
        const [canvasX, canvasY] = getCanvasPoint(event);
        const factor = event.deltaY < 0 ? 1.12 : 0.9;
        zoomAt(canvasX, canvasY, editorSettings.zoom * factor);
    }
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !worldImage) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#120e09';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (mode === 'play') {
            const camera = getPlayCamera();
            ctx.drawImage(worldImage, camera.left * worldImage.naturalWidth, camera.top * worldImage.naturalHeight, camera.width * worldImage.naturalWidth, camera.height * worldImage.naturalHeight, 0, 0, canvas.width, canvas.height);
            for (const zone of zones) {
                const isHovered = hoverZone?.id === zone.id;
                if (!isHovered && !(zone.isDiscovered && zone.isVisibleToPlayer && currentZone?.id === zone.id)) {
                    continue;
                }
                if (zone.shape === 'circle') {
                    const x = ((zone.x ?? 0) - camera.left) / camera.width * canvas.width;
                    const y = ((zone.y ?? 0) - camera.top) / camera.height * canvas.height;
                    const radius = (zone.radius ?? 0.03) * canvas.width / camera.width;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = withAlpha(ZONE_COLORS[zone.type], 0.16);
                    ctx.fill();
                    ctx.lineWidth = isHovered ? 2 : 1;
                    ctx.strokeStyle = isHovered ? '#f2d28f' : '#efe5d1';
                    ctx.stroke();
                }
            }
            const playerRadius = Math.max(5, canvas.width * 0.0075);
            const playerX = ((player.x - camera.left) / camera.width) * canvas.width;
            const playerY = ((player.y - camera.top) / camera.height) * canvas.height;
            ctx.beginPath();
            ctx.fillStyle = '#f8e8b0';
            ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffd55a';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            return;
        }
        if (!editorViewport) {
            return;
        }
        ctx.drawImage(worldImage, editorViewport.panX, editorViewport.panY, worldImage.naturalWidth * editorViewport.zoom, worldImage.naturalHeight * editorViewport.zoom);
        if (regions.length > 0) {
            const cellWidth = (worldImage.naturalWidth * editorViewport.zoom) / REGION_GRID_SIZE;
            const cellHeight = (worldImage.naturalHeight * editorViewport.zoom) / REGION_GRID_SIZE;
            for (const region of regions) {
                ctx.fillStyle = REGION_TYPE_COLORS[region.type] ?? 'rgba(255, 0, 0, 0.35)';
                for (const cell of region.cells) {
                    const x = editorViewport.panX + cell.x * cellWidth;
                    const y = editorViewport.panY + cell.y * cellHeight;
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                }
            }
        }
        if (editorSettings.showGrid) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,240,200,0.15)';
            ctx.lineWidth = 1;
            for (let line = 0; line <= 10; line += 1) {
                const x = (worldImage.naturalWidth * editorViewport.zoom / 10) * line + editorViewport.panX;
                const y = (worldImage.naturalHeight * editorViewport.zoom / 10) * line + editorViewport.panY;
                ctx.beginPath();
                ctx.moveTo(x, editorViewport.panY);
                ctx.lineTo(x, editorViewport.panY + worldImage.naturalHeight * editorViewport.zoom);
                ctx.moveTo(editorViewport.panX, y);
                ctx.lineTo(editorViewport.panX + worldImage.naturalWidth * editorViewport.zoom, y);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (editorSettings.showZones) {
            for (const zone of zones) {
                drawZoneShape(ctx, zone, editorViewport);
                ctx.fillStyle = withAlpha(ZONE_COLORS[zone.type], EDITOR_FILL_ALPHA);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = zone.type === 'dungeon' ? withAlpha(ZONE_DUNGEON_OUTLINE, EDITOR_STROKE_ALPHA) : withAlpha(ZONE_COLORS[zone.type], EDITOR_STROKE_ALPHA);
                ctx.stroke();
            }
        }
        if (hoverZone) {
            drawZoneShape(ctx, hoverZone, editorViewport);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#f2d28f';
            ctx.stroke();
        }
        if (selectedZone) {
            drawZoneShape(ctx, selectedZone, editorViewport);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            drawZoneHandles(ctx, selectedZone, editorViewport);
        }
        if (draft) {
            const geometryValid = draft.shape === 'circle'
                ? draft.x !== null && draft.y !== null && (draft.radius ?? 0) > 0
                : draft.points.length >= 3;
            const color = geometryValid ? ZONE_COLORS[draft.type] : INVALID_DRAFT_COLOR;
            const draftZone = {
                id: draft.id || '__draft__',
                name: draft.name || 'Draft',
                type: draft.type,
                shape: draft.shape,
                x: draft.x ?? undefined,
                y: draft.y ?? undefined,
                radius: draft.radius ?? undefined,
                points: draft.points,
                description: draft.description || 'Draft zone',
                tooltip: draft.tooltip || undefined,
                dangerLevel: draft.dangerLevel,
                recommendedLevel: draft.recommendedLevel ?? undefined,
                requiredLevel: draft.requiredLevel ?? undefined,
                isDiscovered: draft.isDiscovered,
                isVisibleToPlayer: draft.isVisibleToPlayer,
                createdAt: draft.createdAt,
                updatedAt: draft.updatedAt,
            };
            drawZoneShape(ctx, draftZone, editorViewport);
            ctx.fillStyle = withAlpha(color, EDITOR_DRAFT_ALPHA);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.setLineDash([]);
            drawZoneHandles(ctx, draftZone, editorViewport);
            if (draft.shape === 'polygon' && draft.points.length > 0 && cursorPoint) {
                const last = draft.points[draft.points.length - 1];
                const lastScreen = mapNormalizedToScreen(last[0], last[1], editorViewport);
                const cursorScreen = mapNormalizedToScreen(cursorPoint[0], cursorPoint[1], editorViewport);
                ctx.beginPath();
                ctx.moveTo(lastScreen[0], lastScreen[1]);
                ctx.lineTo(cursorScreen[0], cursorScreen[1]);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#fff4d4';
                ctx.stroke();
            }
        }
        if (editorSettings.showLabels) {
            ctx.fillStyle = '#fff4d4';
            ctx.font = '600 11px Georgia';
            zones.forEach((zone) => {
                const [centerX, centerY] = getZoneCenter(zone);
                const [screenX, screenY] = mapNormalizedToScreen(centerX, centerY, editorViewport);
                ctx.fillText(zone.name, screenX + 10, screenY - 10);
            });
        }
        if (dragState?.kind === 'measure') {
            const start = mapNormalizedToScreen(dragState.start[0], dragState.start[1], editorViewport);
            const current = mapNormalizedToScreen(dragState.current[0], dragState.current[1], editorViewport);
            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            ctx.lineTo(current[0], current[1]);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 11px Georgia';
            ctx.fillText(distanceLabel(dragState.start, dragState.current), current[0] + 12, current[1] - 8);
        }
        if (cursorPoint) {
            ctx.fillStyle = '#fff4d4';
            ctx.font = '10px Consolas';
            ctx.fillText(`x:${cursorPoint[0].toFixed(4)} y:${cursorPoint[1].toFixed(4)}`, 10, canvas.height - 12);
        }
    }, [canvasSize.height, canvasSize.width, currentZone, cursorPoint, draft, dragState, editorSettings, editorViewport, hoverZone, mode, player, regions, selectedZone, worldImage, zones]);
    function distanceLabel(a, b) {
        return `d=${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(4)}`;
    }
    return (_jsxs("section", { className: `wm-map card ${mode === 'editor' ? 'is-editor' : ''}`, children: [_jsxs("div", { className: `wm-map-surface ${mode === 'editor' ? 'is-editor' : ''}`, ref: surfaceRef, children: [_jsx("div", { className: "wm-map-title", children: "\u0421\u043E\u043B\u044C\u0435\u0439\u043C\u0430\u0440: \u041C\u0438\u0440" }), _jsx("canvas", { ref: canvasRef, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onDoubleClick: handleDoubleClick, onMouseLeave: handleMouseLeave, onContextMenu: handleContextMenu, onWheel: handleWheel, style: {
                            width: '100%',
                            height: '100%',
                            display: 'block',
                            cursor: mode === 'editor'
                                ? (spacePressed || selectedTool === 'pan' ? 'grab' : selectedTool === 'measure' ? 'crosshair' : 'default')
                                : 'pointer',
                        } }), tooltip ? (_jsxs("div", { className: "wm-zone-tooltip", style: { left: `${tooltip.x + 14}px`, top: `${tooltip.y + 14}px` }, children: [_jsx("strong", { children: tooltip.zone.name }), _jsx("p", { children: tooltip.zone.description })] })) : null, contextMenu ? (_jsx("div", { className: "wm-editor-context-menu", style: { left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }, children: contextMenu.zone ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { onSelectZone?.(contextMenu.zone); setContextMenu(null); }, children: "Select" }), _jsx("button", { onClick: () => { onSelectZone?.(contextMenu.zone); onToolChange?.('select'); setContextMenu(null); }, children: "Edit" }), _jsx("button", { onClick: () => { if (contextMenu.zone) {
                                        onDuplicateZone?.(contextMenu.zone);
                                    } setContextMenu(null); }, children: "Duplicate" }), _jsx("button", { onClick: () => { if (contextMenu.zone) {
                                        onDeleteZone?.(contextMenu.zone.id);
                                    } setContextMenu(null); }, children: "Delete" }), _jsx("button", { onClick: () => { onCopyJson?.(contextMenu.zone); setContextMenu(null); }, children: "Copy Zone JSON" }), _jsx("button", { onClick: () => { if (contextMenu.zone) {
                                        focusZoneInView(contextMenu.zone.id);
                                    } setContextMenu(null); }, children: "Focus" }), _jsx("button", { onClick: () => { if (contextMenu.zone) {
                                        onToggleZoneVisibility?.(contextMenu.zone.id);
                                    } setContextMenu(null); }, children: contextMenu.zone.isVisibleToPlayer ? 'Hide Zone' : 'Show Zone' })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { onToolChange?.('circle'); onSelectZone?.(null); onDraftChange?.({ ...createEmptyZoneDraft('circle'), x: contextMenu.mapPoint[0], y: contextMenu.mapPoint[1], radius: 0.03 }); setContextMenu(null); }, children: "Add Circle Here" }), _jsx("button", { onClick: () => { onToolChange?.('polygon'); onSelectZone?.(null); onDraftChange?.({ ...createEmptyZoneDraft('polygon'), points: [contextMenu.mapPoint] }); setContextMenu(null); }, children: "Start Polygon Here" }), _jsx("button", { onClick: () => { void onPasteZoneAt?.(contextMenu.mapPoint); setContextMenu(null); }, children: "Paste Zone Here" })] })) })) : null] }), mode === 'play' ? (_jsx("footer", { className: "wm-map-legend", children: _jsxs("span", { children: ["\u0418\u0433\u0440\u043E\u043A: ", player.x.toFixed(3), ", ", player.y.toFixed(3), " | \u0417\u043E\u043D\u0430: ", currentZone?.name ?? 'Пустоши', " | \u041D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0435: ", hoverZone?.name ?? '-'] }) })) : null] }));
});
