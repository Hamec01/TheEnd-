import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopStatusBar } from './TopStatusBar';
import { PlayerQuickPanel } from './PlayerQuickPanel';
import { WorldMapCanvas } from './WorldMapCanvas';
import { ContextActionPanel } from './ContextActionPanel';
import { ZoneEditorPanel } from './ZoneEditorPanel';
import { createEmptyHistory, createSnapshot, pushHistory, redoHistory, undoHistory } from './zoneEditorHistory';
import { clearEditorSettingsStorage, clearZoneStorage, exportEditorDataJson, loadEditorDataFromBackend, loadEditorSettings, saveEditorDataToBackend, saveEditorSettings, validateEditorDataJson } from './zoneEditorStorage';
import { createDefaultEditorSettings, createDraftFromZone, createEmptyZoneDraft, createZoneFromDraft } from './zoneEditorTypes';
import { getNearbyPlayers, canAttackNearbyPlayer } from './nearbyPlayersSystem';
import { WORLD_MAP_ZONES } from './worldMapNodes';
import { getZoneCenter, moveZone } from './zoneGeometry';
import { subscribeToContentSync } from '../services/content/contentSync';
const DEFAULT_PLAYER_POSITION = { x: 0.53, y: 0.83 };
const ARKLEIN_MERCHANT_SLOTS = [
    { left: '37%', top: '46%', keywords: ['рынок', 'market', 'bazaar', 'лавка', 'торг'] },
    { left: '68%', top: '35%', keywords: ['куз', 'smith', 'forge', 'blacksmith'] },
    { left: '50%', top: '69%', keywords: ['площадь', 'manor', 'guild', 'центр', 'hall'] },
    { left: '80%', top: '54%', keywords: ['храм', 'church', 'temple', 'cathedral'] },
    { left: '17%', top: '72%', keywords: ['порт', 'dock', 'harbor', 'harbour', 'warehouse', 'склад'] },
    { left: '69%', top: '78%', keywords: ['таверн', 'inn', 'tavern', 'south', 'квартал'] },
];
function assignArkleinMerchantSlots(merchants) {
    const freeSlots = [...ARKLEIN_MERCHANT_SLOTS];
    return merchants.map((merchant, index) => {
        const locationKey = `${merchant.location ?? ''} ${merchant.type}`.trim().toLowerCase();
        const preferredIndex = freeSlots.findIndex((slot) => slot.keywords.some((keyword) => locationKey.includes(keyword)));
        const slotIndex = preferredIndex >= 0 ? preferredIndex : 0;
        const slot = freeSlots.splice(slotIndex, 1)[0] ?? ARKLEIN_MERCHANT_SLOTS[index % ARKLEIN_MERCHANT_SLOTS.length];
        return {
            merchant,
            left: slot.left,
            top: slot.top,
        };
    });
}
function getPlayerPositionStorageKey(characterId) {
    return `theend.worldMap.playerPosition.${characterId}`;
}
function loadPlayerPosition(characterId) {
    if (typeof window === 'undefined') {
        return DEFAULT_PLAYER_POSITION;
    }
    const raw = window.localStorage.getItem(getPlayerPositionStorageKey(characterId));
    if (!raw) {
        return DEFAULT_PLAYER_POSITION;
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === 'number' && Number.isFinite(parsed.x) && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
            return {
                x: Math.max(0, Math.min(1, parsed.x)),
                y: Math.max(0, Math.min(1, parsed.y)),
            };
        }
    }
    catch {
        // Ignore broken saved values and fallback to defaults.
    }
    return DEFAULT_PLAYER_POSITION;
}
function cloneZones(zones) {
    return zones.map((zone) => ({
        ...zone,
        points: zone.points ? zone.points.map((point) => [point[0], point[1]]) : undefined,
    }));
}
function offsetZone(zone, dx, dy) {
    if (zone.shape === 'circle') {
        return {
            ...zone,
            x: Math.max(0, Math.min(1, (zone.x ?? 0) + dx)),
            y: Math.max(0, Math.min(1, (zone.y ?? 0) + dy)),
            updatedAt: Date.now(),
        };
    }
    return moveZone(zone, dx, dy);
}
function buildDraftForTool(tool, currentDraft) {
    const nextDraft = currentDraft ?? createEmptyZoneDraft(tool);
    if (tool === 'polygon') {
        return { ...nextDraft, shape: 'polygon', x: null, y: null, radius: null };
    }
    if (tool === 'rectangle') {
        return { ...nextDraft, shape: 'rect', x: null, y: null, radius: null };
    }
    if (tool === 'circle') {
        return { ...nextDraft, shape: 'circle', points: [], radius: nextDraft.radius ?? 0.03 };
    }
    return nextDraft;
}
function normalizeClipboardText(text) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
        return text;
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.zones)) {
        return text;
    }
    return JSON.stringify([parsed], null, 2);
}
export function WorldMapScreen(props) {
    const { character, inventory, equipment, battleStats, chatLines, onOpenStats, onOpenInventory, onOpenClan, onExit, onOpenArena, onStartCombat, onOpenMerchant, onOpenSkills, onStatus, cityMerchants = [], resolveItemById, resolveItemImage, resolveMerchantImage, } = props;
    const canvasRef = useRef(null);
    const skipNextZonePersistRef = useRef(true);
    const skipNextSettingsPersistRef = useRef(false);
    const worldMapRefreshRef = useRef(null);
    const lastWorldMapRefreshAtRef = useRef(0);
    const [worldMapMode, setWorldMapMode] = useState('play');
    const [contextMode, setContextMode] = useState('empty');
    const [locationView, setLocationView] = useState('map');
    const [currentZone, setCurrentZone] = useState(null);
    const [hoverZone, setHoverZone] = useState(null);
    const [playerState, setPlayerState] = useState('idle');
    const [playerPosition, setPlayerPosition] = useState(() => loadPlayerPosition(character.id));
    const [playSpawnPosition, setPlaySpawnPosition] = useState(() => loadPlayerPosition(character.id));
    const [selectedNearbyPlayerId, setSelectedNearbyPlayerId] = useState(null);
    const [chatType, setChatType] = useState('local');
    const [chatDraft, setChatDraft] = useState('');
    const [systemChat, setSystemChat] = useState([]);
    const [zones, setZones] = useState(() => cloneZones(WORLD_MAP_ZONES));
    const [regions, setRegions] = useState([]);
    const [regionToolMode, setRegionToolMode] = useState('circle');
    const [regionType, setRegionType] = useState('blocked');
    const [regionBrushSize, setRegionBrushSize] = useState(1);
    const [editorSettings, setEditorSettings] = useState(() => (typeof window === 'undefined'
        ? createDefaultEditorSettings()
        : loadEditorSettings()));
    const [editorDraft, setEditorDraft] = useState(null);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [editorJson, setEditorJson] = useState('');
    const [validationErrors, setValidationErrors] = useState([]);
    const [autosaveStatus, setAutosaveStatus] = useState('ready');
    const [mouseCoords, setMouseCoords] = useState({ x: null, y: null });
    const [history, setHistory] = useState(createEmptyHistory());
    const selectedLocationName = currentZone?.name ?? 'Пустоши';
    const nearbyPlayers = useMemo(() => getNearbyPlayers(), []);
    const selectedNearbyPlayer = useMemo(() => nearbyPlayers.find((entry) => entry.id === selectedNearbyPlayerId) ?? nearbyPlayers[0] ?? null, [nearbyPlayers, selectedNearbyPlayerId]);
    const arkleinMerchantHotspots = useMemo(() => assignArkleinMerchantSlots(cityMerchants), [cityMerchants]);
    const canAttackPlayer = canAttackNearbyPlayer(currentZone?.type ?? null);
    const avatarLetter = character.name.trim().charAt(0).toUpperCase() || 'H';
    const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [selectedZoneId, zones]);
    const regionPaintSettings = useMemo(() => ({
        toolMode: regionToolMode,
        regionType,
        brushSize: regionBrushSize,
    }), [regionBrushSize, regionToolMode, regionType]);
    const reloadWorldMapFromBackend = useCallback(async (options) => {
        if (worldMapMode === 'editor') {
            return;
        }
        const now = Date.now();
        if (!options?.force && worldMapRefreshRef.current && now - lastWorldMapRefreshAtRef.current < 1200) {
            return worldMapRefreshRef.current;
        }
        lastWorldMapRefreshAtRef.current = now;
        const refreshPromise = loadEditorDataFromBackend(cloneZones(WORLD_MAP_ZONES))
            .then((loaded) => {
            skipNextZonePersistRef.current = true;
            setZones(loaded.zones);
            setRegions(loaded.regions);
            setCurrentZone((previous) => previous ? loaded.zones.find((zone) => zone.id === previous.id) ?? previous : previous);
            setHoverZone((previous) => previous ? loaded.zones.find((zone) => zone.id === previous.id) ?? previous : previous);
        })
            .catch(() => {
            // Keep the current in-memory map if backend content is unavailable.
        })
            .finally(() => {
            if (worldMapRefreshRef.current === refreshPromise) {
                worldMapRefreshRef.current = null;
            }
        });
        worldMapRefreshRef.current = refreshPromise;
        return refreshPromise;
    }, [worldMapMode]);
    useEffect(() => {
        setEditorJson(exportEditorDataJson(zones, regions));
    }, [regions, zones]);
    useEffect(() => {
        const restored = loadPlayerPosition(character.id);
        setPlayerPosition(restored);
        setPlaySpawnPosition(restored);
    }, [character.id]);
    useEffect(() => {
        if (worldMapMode !== 'play') {
            return;
        }
        void reloadWorldMapFromBackend({ force: true });
    }, [reloadWorldMapFromBackend, worldMapMode]);
    useEffect(() => {
        if (worldMapMode !== 'play') {
            return;
        }
        const refreshVisibleWorldMap = () => {
            void reloadWorldMapFromBackend();
        };
        const unsubscribe = subscribeToContentSync((payload) => {
            if (payload.scope === 'worldMap' || payload.scope === 'all') {
                void reloadWorldMapFromBackend({ force: true });
            }
        });
        const handleFocus = () => {
            refreshVisibleWorldMap();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshVisibleWorldMap();
            }
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            unsubscribe();
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [reloadWorldMapFromBackend, worldMapMode]);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(getPlayerPositionStorageKey(character.id), JSON.stringify(playerPosition));
    }, [character.id, playerPosition]);
    useEffect(() => {
        if (skipNextZonePersistRef.current) {
            skipNextZonePersistRef.current = false;
            return;
        }
        setAutosaveStatus('saving');
        void (async () => {
            try {
                if (zones.length === 0 && regions.length === 0) {
                    clearZoneStorage();
                    await saveEditorDataToBackend([], []);
                }
                else {
                    await saveEditorDataToBackend(zones, regions);
                }
                setAutosaveStatus('autosaved');
            }
            catch {
                setAutosaveStatus('save failed');
            }
        })();
    }, [regions, zones]);
    useEffect(() => {
        if (skipNextSettingsPersistRef.current) {
            skipNextSettingsPersistRef.current = false;
            return;
        }
        saveEditorSettings(editorSettings);
        setAutosaveStatus('autosaved');
    }, [editorSettings]);
    function captureCheckpoint() {
        setHistory((current) => pushHistory(current, createSnapshot(zones, regions, editorDraft, selectedZoneId)));
    }
    function applySnapshot(snapshot) {
        setZones(snapshot.zones);
        setRegions(snapshot.regions);
        setEditorDraft(snapshot.draft);
        setSelectedZoneId(snapshot.selectedZoneId);
        setValidationErrors([]);
    }
    function handleUndo() {
        const current = createSnapshot(zones, regions, editorDraft, selectedZoneId);
        const result = undoHistory(history, current);
        if (!result.snapshot) {
            onStatus('Editor: nothing to undo.');
            return;
        }
        setHistory(result.history);
        applySnapshot(result.snapshot);
        onStatus('Editor: undo.');
    }
    function handleRedo() {
        const current = createSnapshot(zones, regions, editorDraft, selectedZoneId);
        const result = redoHistory(history, current);
        if (!result.snapshot) {
            onStatus('Editor: nothing to redo.');
            return;
        }
        setHistory(result.history);
        applySnapshot(result.snapshot);
        onStatus('Editor: redo.');
    }
    const selectedNode = useMemo(() => {
        if (!currentZone) {
            return null;
        }
        const [zoneCenterX, zoneCenterY] = getZoneCenter(currentZone);
        const dangerLabel = currentZone.dangerLevel >= 5 ? 'High' : currentZone.dangerLevel >= 3 ? 'Medium' : 'Low';
        const access = currentZone.requiredLevel && currentZone.requiredLevel > character.level ? 'Locked' : 'Neutral';
        const actions = [];
        if (currentZone.type === 'city') {
            actions.push({ id: 'open-city', label: 'Войти в город', kind: 'enter' });
            actions.push({ id: 'trade', label: 'Торговец', kind: 'trade' });
            actions.push({ id: 'talk', label: 'Поговорить с NPC', kind: 'talk' });
        }
        if (currentZone.type === 'grind' || currentZone.type === 'danger' || currentZone.type === 'dungeon') {
            actions.push({ id: 'enter-battle', label: 'Искать бой', kind: 'combat' });
            actions.push({ id: 'scout-enemy', label: 'Разведка', kind: 'scout' });
        }
        if (currentZone.type === 'resource') {
            actions.push({ id: 'gather', label: 'Добывать ресурс', kind: 'quest' });
        }
        if (currentZone.type === 'profession') {
            actions.push({ id: 'profession-train', label: 'Обучение профессии', kind: 'talk' });
        }
        if (actions.length === 0) {
            actions.push({ id: 'look-around', label: 'Осмотреться', kind: 'scout' });
        }
        return {
            id: currentZone.id,
            name: currentZone.name,
            type: currentZone.type,
            faction: currentZone.faction ?? (currentZone.type === 'danger' ? 'Враждебная зона' : 'Нейтральная зона'),
            danger: dangerLabel,
            access,
            recommendedLevel: Math.max(1, currentZone.recommendedLevel ?? currentZone.dangerLevel),
            description: currentZone.description,
            tooltip: currentZone.tooltip ?? currentZone.description,
            x: zoneCenterX,
            y: zoneCenterY,
            actions,
        };
    }, [character.level, currentZone]);
    const chatMessages = useMemo(() => {
        const localMessages = chatLines.map((line, index) => ({
            id: `local-${index}-${line}`,
            text: line,
            type: 'local',
        }));
        return [...localMessages, ...systemChat].slice(-24);
    }, [chatLines, systemChat]);
    const quickButtons = useMemo(() => [
        {
            id: 'combat',
            tone: 'red',
            icon: '⚔',
            title: 'Combat status',
            onClick: () => setContextMode('combat'),
        },
        {
            id: 'messages',
            tone: 'blue',
            icon: '✉',
            title: 'Messages / quests / notifications',
            badge: 3,
            onClick: () => setContextMode('npc'),
        },
        {
            id: 'inventory',
            tone: 'yellow',
            icon: '🎒',
            title: 'Инвентарь и экипировка',
            onClick: onOpenInventory,
        },
    ], [onOpenInventory]);
    // Memoize callbacks to prevent infinite loops in animation frames
    const handlePlayerPosition = useCallback((x, y) => {
        setPlayerPosition({ x, y });
    }, []);
    const handlePlayerState = useCallback((state) => {
        setPlayerState(state);
    }, []);
    const handleHoverZone = useCallback((zone) => {
        setHoverZone(zone);
    }, []);
    const rememberCurrentMapPosition = useCallback(() => {
        setPlaySpawnPosition((current) => {
            if (current.x === playerPosition.x && current.y === playerPosition.y) {
                return current;
            }
            return playerPosition;
        });
    }, [playerPosition]);
    const handleZoneEnterMemoized = useCallback((zone) => {
        setCurrentZone(zone);
        if (worldMapMode === 'editor') {
            return;
        }
        if (!zone) {
            setContextMode('empty');
            return;
        }
        setContextMode('location');
        setPlayerState(zone.type === 'city' ? 'in_city' : 'in_zone');
        const entry = {
            id: `sys-zone-${Date.now()}-${zone.id}`,
            text: `Вы вошли в: ${zone.name}`,
            type: 'system',
        };
        setSystemChat((prev) => [...prev, entry].slice(-12));
    }, [worldMapMode]);
    function setMode(mode) {
        if (mode !== 'play') {
            rememberCurrentMapPosition();
        }
        setWorldMapMode(mode);
        if (mode === 'editor') {
            setLocationView('map');
            setContextMode('empty');
            onStatus('Editor mode enabled. Gameplay panels hidden.');
            return;
        }
        onStatus('Play mode enabled.');
    }
    function validateDraft(draft) {
        if (!draft) {
            onStatus('Editor: no draft to save.');
            return false;
        }
        if (!draft.id.trim() || !draft.name.trim() || !draft.description.trim()) {
            onStatus('Editor: id, name and description are required.');
            return false;
        }
        if (draft.shape === 'circle') {
            if (draft.x === null || draft.y === null || draft.radius === null || draft.radius <= 0) {
                onStatus('Editor: circle requires x, y and radius.');
                return false;
            }
        }
        else if (draft.points.length < 3) {
            onStatus('Editor: polygon/rect requires at least 3 points.');
            return false;
        }
        return true;
    }
    function upsertZone(nextZone) {
        setZones((prev) => [...prev.filter((zone) => zone.id !== nextZone.id), nextZone]);
        setSelectedZoneId(nextZone.id);
        setEditorDraft(createDraftFromZone(nextZone));
    }
    function handleSaveNewZone() {
        if (!validateDraft(editorDraft)) {
            return;
        }
        const duplicate = zones.find((zone) => zone.id === editorDraft.id);
        if (duplicate && duplicate.id !== selectedZoneId && !window.confirm(`Zone id ${editorDraft.id} already exists. Replace it?`)) {
            return;
        }
        captureCheckpoint();
        const nextZone = createZoneFromDraft(editorDraft, duplicate?.createdAt);
        upsertZone(nextZone);
        onStatus(`Editor: saved zone ${nextZone.name}.`);
    }
    function handleUpdateSelectedZone() {
        if (!selectedZoneId) {
            onStatus('Editor: no selected zone.');
            return;
        }
        if (!validateDraft(editorDraft)) {
            return;
        }
        const existing = zones.find((zone) => zone.id === selectedZoneId) ?? null;
        captureCheckpoint();
        const nextZone = createZoneFromDraft(editorDraft, existing?.createdAt);
        setZones((prev) => [...prev.filter((zone) => zone.id !== selectedZoneId && zone.id !== nextZone.id), nextZone]);
        setSelectedZoneId(nextZone.id);
        setEditorDraft(createDraftFromZone(nextZone));
        onStatus(`Editor: updated zone ${nextZone.name}.`);
    }
    function handleConfirmDraft() {
        if (selectedZoneId) {
            handleUpdateSelectedZone();
            return;
        }
        handleSaveNewZone();
    }
    function handleDuplicateSelected(zoneOverride) {
        const source = zoneOverride ?? selectedZone;
        if (!source) {
            onStatus('Editor: no selected zone to duplicate.');
            return;
        }
        captureCheckpoint();
        const duplicated = offsetZone({
            ...source,
            id: `${source.id}_copy`,
            name: `${source.name} Copy`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }, 0.01, 0.01);
        let suffix = 1;
        while (zones.some((zone) => zone.id === duplicated.id)) {
            duplicated.id = `${source.id}_copy_${suffix}`;
            suffix += 1;
        }
        setZones((prev) => [...prev, duplicated]);
        setSelectedZoneId(duplicated.id);
        setEditorDraft(createDraftFromZone(duplicated));
        onStatus(`Editor: duplicated ${source.name}.`);
    }
    function handleDeleteZone(zoneId = selectedZoneId) {
        if (!zoneId) {
            onStatus('Editor: nothing to delete.');
            return;
        }
        captureCheckpoint();
        setZones((prev) => prev.filter((zone) => zone.id !== zoneId));
        if (selectedZoneId === zoneId) {
            setSelectedZoneId(null);
            setEditorDraft(null);
        }
        onStatus(`Editor: deleted zone ${zoneId}.`);
    }
    function handleClearDraft() {
        setEditorDraft(null);
        setSelectedZoneId(null);
        onStatus('Editor: draft cleared.');
    }
    function handleClearAllZones() {
        if (!window.confirm('Delete all zones and painted regions from the editor?')) {
            return;
        }
        captureCheckpoint();
        setZones([]);
        setRegions([]);
        setSelectedZoneId(null);
        setEditorDraft(null);
        setEditorJson('');
        clearZoneStorage();
        void saveEditorDataToBackend([], []);
        onStatus('Editor: all zones and regions cleared.');
    }
    function handleResetStorage() {
        skipNextZonePersistRef.current = true;
        skipNextSettingsPersistRef.current = true;
        clearZoneStorage();
        void saveEditorDataToBackend([], []);
        clearEditorSettingsStorage();
        setZones(cloneZones(WORLD_MAP_ZONES));
        setRegions([]);
        setEditorSettings(createDefaultEditorSettings());
        setSelectedZoneId(null);
        setEditorDraft(null);
        setValidationErrors([]);
        setHistory(createEmptyHistory());
        setEditorJson(exportEditorDataJson(cloneZones(WORLD_MAP_ZONES), []));
        onStatus('Editor: storage reset to defaults.');
    }
    function handleExportJson() {
        setEditorJson(exportEditorDataJson(zones, regions));
        setValidationErrors([]);
        onStatus('Editor: JSON exported to textarea.');
    }
    async function handleCopyJson(zone = selectedZone) {
        const payload = zone ? JSON.stringify(zone, null, 2) : exportEditorDataJson(zones, regions);
        setEditorJson(payload);
        try {
            await navigator.clipboard.writeText(payload);
            onStatus(zone ? `Copied zone JSON: ${zone.id}` : 'Copied zones JSON');
        }
        catch {
            onStatus('Editor: clipboard copy failed, JSON left in textarea.');
        }
    }
    function validateJsonText(text) {
        try {
            return validateEditorDataJson(normalizeClipboardText(text));
        }
        catch {
            return { valid: false, errors: ['Invalid JSON syntax'], zones: [], regions: [] };
        }
    }
    function handleValidateJson() {
        const result = validateJsonText(editorJson);
        setValidationErrors(result.errors);
        onStatus(result.valid
            ? `JSON valid: ${result.zones.length} zones, ${result.regions.length} regions`
            : `JSON invalid: ${result.errors.length} errors`);
    }
    function mergeImportedData(importedZones, importedRegions) {
        const importedIds = new Set(importedZones.map((zone) => zone.id));
        const importedRegionIds = new Set(importedRegions.map((region) => region.id));
        const duplicates = zones.filter((zone) => importedIds.has(zone.id));
        const regionDuplicates = regions.filter((region) => importedRegionIds.has(region.id));
        if ((duplicates.length > 0 || regionDuplicates.length > 0)
            && !window.confirm(`Replace ${duplicates.length} zones and ${regionDuplicates.length} regions with matching ids?`)) {
            return false;
        }
        captureCheckpoint();
        setZones((prev) => [...prev.filter((zone) => !importedIds.has(zone.id)), ...importedZones]);
        setRegions((prev) => [...prev.filter((region) => !importedRegionIds.has(region.id)), ...importedRegions]);
        setSelectedZoneId(null);
        setEditorDraft(null);
        return true;
    }
    function handleImportJson() {
        const result = validateJsonText(editorJson);
        setValidationErrors(result.errors);
        if (!result.valid) {
            onStatus(`Editor: import failed with ${result.errors.length} errors.`);
            return;
        }
        if (mergeImportedData(result.zones, result.regions)) {
            onStatus(`Editor: imported ${result.zones.length} zones and ${result.regions.length} regions.`);
        }
    }
    async function handlePasteZoneAt(point) {
        try {
            const raw = await navigator.clipboard.readText();
            const result = validateJsonText(raw);
            if (!result.valid) {
                setValidationErrors(result.errors);
                onStatus('Editor: clipboard JSON invalid.');
                return;
            }
            const importedZones = result.zones;
            const anchor = importedZones.length === 1
                ? getZoneCenter(importedZones[0])
                : importedZones.reduce((acc, zone) => {
                    const center = getZoneCenter(zone);
                    return [acc[0] + center[0], acc[1] + center[1]];
                }, [0, 0]).map((value) => value / importedZones.length);
            const offsetX = point[0] - anchor[0];
            const offsetY = point[1] - anchor[1];
            const shiftedZones = importedZones.map((zone) => ({
                ...offsetZone(zone, offsetX, offsetY),
                id: zones.some((entry) => entry.id === zone.id) ? `${zone.id}_${Date.now()}` : zone.id,
                updatedAt: Date.now(),
                createdAt: Date.now(),
            }));
            captureCheckpoint();
            setZones((prev) => [...prev, ...shiftedZones]);
            onStatus(`Editor: pasted ${shiftedZones.length} zones.`);
        }
        catch {
            onStatus('Editor: clipboard paste failed.');
        }
    }
    function handleToggleZoneVisibility(zoneId) {
        captureCheckpoint();
        setZones((prev) => prev.map((zone) => (zone.id === zoneId ? { ...zone, isVisibleToPlayer: !zone.isVisibleToPlayer, updatedAt: Date.now() } : zone)));
    }
    function handleToolChange(tool) {
        setEditorSettings((prev) => ({ ...prev, selectedTool: tool }));
        if (tool === 'circle' || tool === 'polygon' || tool === 'rectangle') {
            setSelectedZoneId(null);
            setEditorDraft((current) => buildDraftForTool(tool, current));
        }
    }
    function handleDraftChange(draft) {
        setEditorDraft(draft);
        if (!draft) {
            return;
        }
        if (!selectedZoneId) {
            return;
        }
        if (draft.id !== selectedZoneId) {
            setSelectedZoneId(selectedZoneId);
        }
    }
    function handleSelectZone(zone) {
        setSelectedZoneId(zone?.id ?? null);
        setEditorDraft(zone ? createDraftFromZone(zone) : null);
    }
    function handleDeleteSelectedPoint() {
        if (!editorDraft || editorDraft.selectedPointIndex === null) {
            return;
        }
        const nextPoints = editorDraft.points.filter((_, index) => index !== editorDraft.selectedPointIndex);
        setEditorDraft({
            ...editorDraft,
            points: nextPoints,
            selectedPointIndex: null,
            updatedAt: Date.now(),
        });
    }
    function handleReversePoints() {
        if (!editorDraft || editorDraft.points.length < 3) {
            return;
        }
        setEditorDraft({
            ...editorDraft,
            points: [...editorDraft.points].reverse(),
            selectedPointIndex: null,
            updatedAt: Date.now(),
        });
    }
    function handleEditorViewChange(patch) {
        setEditorSettings((prev) => ({ ...prev, ...patch }));
    }
    function handleSaveShortcut() {
        void saveEditorDataToBackend(zones, regions);
        saveEditorSettings(editorSettings);
        setAutosaveStatus('autosaved');
        onStatus('Editor: saved to backend content store.');
    }
    async function handleAction(actionId, kind) {
        if (worldMapMode === 'editor') {
            return;
        }
        if (kind === 'combat' || actionId === 'enter-battle') {
            if (currentZone?.type === 'safe' || currentZone?.type === 'city' || currentZone?.type === 'settlement') {
                onStatus('В безопасной зоне бой запрещен.');
                return;
            }
            if (Math.random() < 0.5 || currentZone?.type === 'danger' || currentZone?.type === 'grind') {
                await onStartCombat();
                setPlayerState('in_combat');
                setContextMode('combat');
                onStatus('Враг найден. Бой начался.');
            }
            else {
                onStatus('Поблизости нет врагов. Попробуйте снова.');
            }
            return;
        }
        if (actionId === 'open-city' && currentZone?.type === 'city') {
            handleOpenLocation(currentZone.id);
            return;
        }
        if (kind === 'trade' && currentZone?.type === 'city') {
            if (cityMerchants.length === 0) {
                onStatus('В этом городе пока нет торговцев из админки. Создайте торговца и укажите город "Арклейн".');
                return;
            }
            if (cityMerchants.length === 1) {
                onOpenMerchant(cityMerchants[0].id);
                onStatus(`Открыт торговец: ${cityMerchants[0].name}.`);
                return;
            }
            setLocationView('arklein');
            setContextMode('location');
            onStatus('Войдите в город и выберите торговца на карте.');
            return;
        }
        if (kind === 'trade') {
            onOpenMerchant();
            onStatus(`Открыт торговец в ${selectedLocationName}.`);
            return;
        }
        if (kind === 'talk' || kind === 'quest') {
            setContextMode('npc');
            onStatus(`Interaction started in ${selectedLocationName}.`);
            return;
        }
        onStatus(`Action: ${actionId}`);
    }
    function handleOpenLocation(locationId) {
        if (worldMapMode === 'editor') {
            return;
        }
        const zone = zones.find((entry) => entry.id === locationId) ?? null;
        const opensArkleinScene = locationId === 'arklein' || zone?.targetScene === 'city_arklein';
        if (!opensArkleinScene) {
            onStatus(`Локация ${locationId} пока недоступна.`);
            return;
        }
        rememberCurrentMapPosition();
        setLocationView('arklein');
        setContextMode('location');
        setPlayerState('in_city');
        onStatus(`Вы вошли в ${zone?.name ?? 'Арклейн'}.`);
    }
    function handleReturnToMap() {
        rememberCurrentMapPosition();
        setLocationView('map');
        setContextMode(currentZone ? 'location' : 'empty');
        setPlayerState(currentZone ? 'in_zone' : 'idle');
    }
    function handleNearbyAction(action, player) {
        if (action === 'attack') {
            if (!canAttackPlayer) {
                onStatus('В этой зоне PvP запрещен.');
                return;
            }
            onStatus(`Вы атакуете игрока ${player.name}.`);
            return;
        }
        if (action === 'message') {
            setChatType('private');
            setChatDraft(`/w ${player.name} `);
            onStatus(`Приватный чат с ${player.name}.`);
            return;
        }
        if (action === 'trade') {
            onStatus(`Запрос на торговлю отправлен игроку ${player.name}.`);
            return;
        }
        onStatus(`${player.name}: уровень ${player.level}, состояние ${player.state}.`);
    }
    function handleSendChat() {
        const text = chatDraft.trim();
        if (!text) {
            return;
        }
        const entry = { id: `msg-${Date.now()}`, text, type: chatType };
        setSystemChat((prev) => [...prev, entry].slice(-12));
        setChatDraft('');
    }
    function handleEnterArena() {
        onOpenArena();
    }
    const playLayout = (_jsxs(_Fragment, { children: [_jsx(TopStatusBar, { name: character.name, gold: inventory.gold, level: character.level, exp: character.exp, statusValue: character.activeStats.strength, oreValue: Math.max(0, character.activeStats.constitution + 80), crystalValue: Math.max(0, character.activeStats.intelligence + 40), woodValue: Math.max(0, character.activeStats.stamina - 10), meatValue: Math.max(0, character.activeStats.hp - 160), herbValue: Math.max(0, character.activeStats.perception + 2), onStats: onOpenStats, onSkills: onOpenSkills, onInventory: onOpenInventory, onMap: () => {
                    if (locationView === 'map') {
                        setContextMode(currentZone ? 'location' : 'empty');
                        return;
                    }
                    handleReturnToMap();
                }, onClan: onOpenClan, onExit: onExit }), _jsxs("section", { className: "wm-grid", children: [_jsx(PlayerQuickPanel, { name: character.name, avatarLetter: avatarLetter, hpText: `${battleStats.hp}/${character.activeStats.hp}`, mpText: `${battleStats.mp}/${character.activeStats.mp}`, staminaText: `${battleStats.stamina}/${character.activeStats.stamina}`, activeStats: character.activeStats, equipment: equipment, inventory: inventory, quickActions: quickButtons, resolveItemById: resolveItemById, resolveItemImage: resolveItemImage }), locationView === 'map' ? (_jsx(WorldMapCanvas, { mode: "play", playerStartPosition: playSpawnPosition, zones: zones, regions: regions, onOpenLocation: handleOpenLocation, onEnterZone: handleZoneEnterMemoized, onHoverZone: handleHoverZone, onPlayerPosition: handlePlayerPosition, onPlayerState: handlePlayerState })) : (_jsxs("section", { className: "wm-map card", children: [_jsxs("div", { className: "wm-map-surface wm-city-surface", style: { backgroundImage: "linear-gradient(rgba(24, 17, 12, 0.38), rgba(24, 17, 12, 0.62)), url('/map/City_Arclain.png')" }, children: [_jsx("div", { className: "wm-map-title", children: "\u0410\u0440\u043A\u043B\u0435\u0439\u043D" }), _jsxs("div", { className: "wm-city-hotspots", children: [_jsx("button", { type: "button", className: "wm-city-hotspot hotspot-arena", onClick: handleEnterArena, children: "\u0410\u0440\u0435\u043D\u0430" }), arkleinMerchantHotspots.map(({ merchant, left, top }) => {
                                                const portrait = resolveMerchantImage?.(merchant);
                                                const subtitle = merchant.location?.trim() || merchant.type.replace(/_/g, ' ');
                                                const merchantInitial = merchant.name.trim().charAt(0).toUpperCase() || 'Т';
                                                return (_jsxs("button", { type: "button", className: "wm-city-hotspot wm-city-merchant-hotspot", style: { left, top }, onClick: () => onOpenMerchant(merchant.id), children: [portrait ? (_jsx("img", { src: portrait, alt: merchant.name })) : (_jsx("span", { className: "wm-city-merchant-avatar", "aria-hidden": "true", children: merchantInitial })), _jsxs("span", { className: "wm-city-merchant-copy", children: [_jsx("strong", { children: merchant.name }), _jsx("span", { children: subtitle })] })] }, merchant.id));
                                            }), arkleinMerchantHotspots.length === 0 ? (_jsx("div", { className: "wm-city-empty-note", children: "\u0412 \u0410\u0440\u043A\u043B\u0435\u0439\u043D\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0435\u0432 \u0438\u0437 \u0430\u0434\u043C\u0438\u043D\u043A\u0438. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430 \u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0433\u043E\u0440\u043E\u0434: \u0410\u0440\u043A\u043B\u0435\u0439\u043D." })) : null] })] }), _jsxs("footer", { className: "wm-map-legend", children: [_jsx("span", { children: "\u0410\u0440\u043A\u043B\u0435\u0439\u043D | \u0422\u043E\u0440\u0433\u043E\u0432\u0446\u044B \u0438\u0437 \u0430\u0434\u043C\u0438\u043D\u043A\u0438 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438, \u0435\u0441\u043B\u0438 \u0443 \u043D\u0438\u0445 \u0443\u043A\u0430\u0437\u0430\u043D \u0433\u043E\u0440\u043E\u0434 \"\u0410\u0440\u043A\u043B\u0435\u0439\u043D\"." }), _jsx("button", { className: "wm-city-back", onClick: handleReturnToMap, children: "\u041D\u0430\u0437\u0430\u0434 \u043A \u043A\u0430\u0440\u0442\u0435" })] })] })), _jsxs("div", { className: "wm-right-stack", children: [_jsx("div", { className: "wm-editor-launch card", children: _jsx("button", { onClick: () => setMode('editor'), children: "Zone Editor" }) }), _jsx(ContextActionPanel, { mode: contextMode, selectedNode: selectedNode, onAction: (actionId, kind) => { void handleAction(actionId, kind); } }), _jsx("section", { className: "wm-context card", style: { borderTop: 'none' }, children: _jsxs("section", { className: "wm-context-block", children: [_jsx("h3", { children: "\u0418\u0433\u0440\u043E\u043A\u0438 \u0440\u044F\u0434\u043E\u043C" }), nearbyPlayers.map((entry) => (_jsxs("button", { style: { width: '100%', marginBottom: '6px', textAlign: 'left', opacity: selectedNearbyPlayer?.id === entry.id ? 1 : 0.82 }, onClick: () => setSelectedNearbyPlayerId(entry.id), children: [entry.name, " (\u0443\u0440.", entry.level, ") [", entry.state, "]"] }, entry.id))), selectedNearbyPlayer ? (_jsxs("div", { className: "wm-action-grid", style: { marginTop: '8px' }, children: [_jsx("button", { disabled: !canAttackPlayer, onClick: () => handleNearbyAction('attack', selectedNearbyPlayer), children: "\u041D\u0430\u043F\u0430\u0441\u0442\u044C" }), _jsx("button", { onClick: () => handleNearbyAction('message', selectedNearbyPlayer), children: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C" }), _jsx("button", { onClick: () => handleNearbyAction('trade', selectedNearbyPlayer), children: "\u0422\u043E\u0440\u0433\u043E\u0432\u0430\u0442\u044C" }), _jsx("button", { onClick: () => handleNearbyAction('inspect', selectedNearbyPlayer), children: "\u041E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C" })] })) : null] }) }), _jsxs("section", { className: "wm-chat card", children: [_jsx("h3", { children: "\u0427\u0430\u0442" }), _jsx("div", { className: "wm-chat-log", children: chatMessages.map((line) => (_jsxs("p", { children: [_jsxs("strong", { children: ["[", line.type.toUpperCase(), "]"] }), " ", line.text] }, line.id))) }), _jsxs("div", { className: "wm-chat-input", children: [_jsxs("select", { value: chatType, onChange: (event) => setChatType(event.target.value), children: [_jsx("option", { value: "local", children: "local" }), _jsx("option", { value: "private", children: "private" }), _jsx("option", { value: "system", children: "system" })] }), _jsx("input", { value: chatDraft, onChange: (event) => setChatDraft(event.target.value), placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435..." }), _jsx("button", { onClick: handleSendChat, children: "\u25B6" })] })] })] })] }), _jsxs("footer", { className: "wm-footer card", children: [_jsxs("span", { children: ["\u041B\u043E\u043A\u0430\u0446\u0438\u044F: ", selectedLocationName, " | \u041A\u043E\u043E\u0440\u0434: ", playerPosition.x.toFixed(3), ", ", playerPosition.y.toFixed(3)] }), _jsxs("span", { children: ["\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435: ", playerState] }), _jsxs("span", { children: ["\u041F\u043E\u0434 \u043A\u0443\u0440\u0441\u043E\u0440\u043E\u043C: ", hoverZone?.name ?? '-'] }), _jsx("span", { children: "\u041E\u043D\u043B\u0430\u0439\u043D: 124" }), _jsx("span", { children: "22:41" })] })] }));
    const editorLayout = (_jsxs("section", { className: "wm-editor-shell", children: [_jsxs("div", { className: "wm-editor-toolbar card", children: [_jsxs("div", { className: "wm-editor-toolbar-group", children: [_jsx("button", { onClick: () => setMode('play'), children: "Play Mode" }), _jsx("button", { className: "is-active", onClick: () => setMode('editor'), children: "Editor Mode" })] }), _jsxs("div", { className: "wm-editor-toolbar-group", children: [_jsx("button", { className: editorSettings.selectedTool === 'select' ? 'is-active' : '', onClick: () => handleToolChange('select'), children: "Select" }), _jsx("button", { className: editorSettings.selectedTool === 'circle' ? 'is-active' : '', onClick: () => handleToolChange('circle'), children: "Circle" }), _jsx("button", { className: editorSettings.selectedTool === 'polygon' ? 'is-active' : '', onClick: () => handleToolChange('polygon'), children: "Polygon" }), _jsx("button", { className: editorSettings.selectedTool === 'rectangle' ? 'is-active' : '', onClick: () => handleToolChange('rectangle'), children: "Rectangle" }), _jsx("button", { className: editorSettings.selectedTool === 'pan' ? 'is-active' : '', onClick: () => handleToolChange('pan'), children: "Pan" }), _jsx("button", { className: editorSettings.selectedTool === 'measure' ? 'is-active' : '', onClick: () => handleToolChange('measure'), children: "Measure" })] }), _jsxs("div", { className: "wm-editor-toolbar-group", children: [_jsx("button", { onClick: handleUndo, children: "Undo" }), _jsx("button", { onClick: handleRedo, children: "Redo" }), _jsx("button", { onClick: () => canvasRef.current?.fitToScreen(), children: "Fit" }), _jsx("button", { onClick: () => canvasRef.current?.focusZone(selectedZoneId), children: "Focus" }), _jsx("button", { onClick: handleSaveShortcut, children: "Save" })] })] }), _jsxs("div", { className: "wm-editor-main", children: [_jsx("div", { className: "wm-editor-map-area card", children: _jsx(WorldMapCanvas, { ref: canvasRef, mode: "editor", zones: zones, regions: regions, selectedZoneId: selectedZoneId, selectedTool: editorSettings.selectedTool, settings: editorSettings, draft: editorDraft, regionPaintSettings: regionPaintSettings, onSettingsChange: handleEditorViewChange, onDraftChange: handleDraftChange, onZonesChange: setZones, onRegionsChange: setRegions, onRegionCheckpoint: captureCheckpoint, onSelectZone: handleSelectZone, onCheckpoint: captureCheckpoint, onDeleteZone: handleDeleteZone, onDuplicateZone: handleDuplicateSelected, onToggleZoneVisibility: handleToggleZoneVisibility, onCopyJson: handleCopyJson, onPasteZoneAt: handlePasteZoneAt, onConfirmDraft: handleConfirmDraft, onUndo: handleUndo, onRedo: handleRedo, onSaveShortcut: handleSaveShortcut, onToolChange: handleToolChange, onStatusMessage: onStatus, onMouseCoordinatesChange: setMouseCoords, onHoverZone: (zone) => setHoverZone(zone) }) }), _jsx(ZoneEditorPanel, { draft: editorDraft, zones: zones, selectedZoneId: selectedZoneId, selectedTool: editorSettings.selectedTool, settings: editorSettings, jsonValue: editorJson, validationErrors: validationErrors, regionToolMode: regionToolMode, regionType: regionType, regionBrushSize: regionBrushSize, onRegionToolModeChange: setRegionToolMode, onRegionTypeChange: setRegionType, onRegionBrushSizeChange: setRegionBrushSize, onToolChange: handleToolChange, onSettingsChange: handleEditorViewChange, onDraftChange: handleDraftChange, onSaveNewZone: handleSaveNewZone, onUpdateSelected: handleUpdateSelectedZone, onDuplicateSelected: () => handleDuplicateSelected(), onDeleteSelected: () => handleDeleteZone(), onClearDraft: handleClearDraft, onClearAll: handleClearAllZones, onResetStorage: handleResetStorage, onExport: handleExportJson, onCopyJson: () => { void handleCopyJson(); }, onImportJson: handleImportJson, onValidateJson: handleValidateJson, onJsonChange: setEditorJson, onDeleteSelectedPoint: handleDeleteSelectedPoint, onReversePoints: handleReversePoints })] }), _jsxs("div", { className: "wm-editor-statusbar card", children: [_jsxs("span", { children: ["x: ", mouseCoords.x?.toFixed(4) ?? '-', " y: ", mouseCoords.y?.toFixed(4) ?? '-'] }), _jsxs("span", { children: ["zoom ", Math.round(editorSettings.zoom * 100), "%"] }), _jsxs("span", { children: ["tool: ", editorSettings.selectedTool] }), _jsxs("span", { children: ["selected: ", selectedZone?.id ?? '-'] }), _jsxs("span", { children: ["draft: ", editorDraft ? `${editorDraft.shape}${editorDraft.points.length ? ` (${editorDraft.points.length})` : ''}` : '-'] }), _jsxs("span", { children: ["zones: ", zones.length] }), _jsxs("span", { children: ["regions: ", regions.length] }), _jsx("span", { children: autosaveStatus })] })] }));
    return _jsx("section", { className: "wm-shell", children: worldMapMode === 'play' ? playLayout : editorLayout });
}
