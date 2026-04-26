export function createEmptyZoneDraft(tool = 'circle') {
    const now = Date.now();
    const shape = tool === 'rectangle' ? 'rect' : tool === 'polygon' ? 'polygon' : 'circle';
    return {
        id: '',
        name: '',
        type: 'city',
        shape,
        x: null,
        y: null,
        radius: shape === 'circle' ? 0.03 : null,
        points: [],
        region: '',
        faction: '',
        description: '',
        tooltip: '',
        dangerLevel: 1,
        recommendedLevel: null,
        requiredLevel: null,
        requiredQuestId: '',
        requiredItemId: '',
        requiredFaction: '',
        targetScene: '',
        isDiscovered: true,
        isVisibleToPlayer: true,
        isSafeZone: false,
        allowPvP: false,
        enemyTableId: '',
        resourceTableId: '',
        professionId: '',
        respawnSeconds: null,
        cooldownSeconds: null,
        createdAt: now,
        updatedAt: now,
        selectedPointIndex: null,
    };
}
export function createDraftFromZone(zone) {
    return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        shape: zone.shape,
        x: zone.x ?? null,
        y: zone.y ?? null,
        radius: zone.radius ?? null,
        points: zone.points ? [...zone.points] : [],
        region: zone.region ?? '',
        faction: zone.faction ?? '',
        description: zone.description,
        tooltip: zone.tooltip ?? '',
        dangerLevel: zone.dangerLevel,
        recommendedLevel: zone.recommendedLevel ?? null,
        requiredLevel: zone.requiredLevel ?? null,
        requiredQuestId: zone.requiredQuestId ?? '',
        requiredItemId: zone.requiredItemId ?? '',
        requiredFaction: zone.requiredFaction ?? '',
        targetScene: zone.targetScene ?? '',
        isDiscovered: zone.isDiscovered,
        isVisibleToPlayer: zone.isVisibleToPlayer,
        isSafeZone: zone.isSafeZone ?? false,
        allowPvP: zone.allowPvP ?? false,
        enemyTableId: zone.enemyTableId ?? '',
        resourceTableId: zone.resourceTableId ?? '',
        professionId: zone.professionId ?? '',
        respawnSeconds: zone.respawnSeconds ?? null,
        cooldownSeconds: zone.cooldownSeconds ?? null,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
        selectedPointIndex: null,
    };
}
export function createZoneFromDraft(draft, existingCreatedAt) {
    const now = Date.now();
    const base = {
        id: draft.id.trim(),
        name: draft.name.trim(),
        type: draft.type,
        shape: draft.shape,
        region: draft.region.trim() || undefined,
        faction: draft.faction.trim() || undefined,
        description: draft.description.trim(),
        tooltip: draft.tooltip.trim() || undefined,
        dangerLevel: draft.dangerLevel,
        recommendedLevel: draft.recommendedLevel ?? undefined,
        requiredLevel: draft.requiredLevel ?? undefined,
        requiredQuestId: draft.requiredQuestId.trim() || undefined,
        requiredItemId: draft.requiredItemId.trim() || undefined,
        requiredFaction: draft.requiredFaction.trim() || undefined,
        targetScene: draft.targetScene.trim() || undefined,
        isDiscovered: draft.isDiscovered,
        isVisibleToPlayer: draft.isVisibleToPlayer,
        isSafeZone: draft.isSafeZone || undefined,
        allowPvP: draft.allowPvP || undefined,
        enemyTableId: draft.enemyTableId.trim() || undefined,
        resourceTableId: draft.resourceTableId.trim() || undefined,
        professionId: draft.professionId.trim() || undefined,
        respawnSeconds: draft.respawnSeconds ?? undefined,
        cooldownSeconds: draft.cooldownSeconds ?? undefined,
        createdAt: existingCreatedAt ?? draft.createdAt ?? now,
        updatedAt: now,
    };
    if (draft.shape === 'circle') {
        return {
            ...base,
            x: draft.x ?? undefined,
            y: draft.y ?? undefined,
            radius: draft.radius ?? undefined,
        };
    }
    return {
        ...base,
        points: draft.points.map((point) => [point[0], point[1]]),
    };
}
export function createDefaultEditorSettings() {
    return {
        showZones: true,
        showLabels: true,
        showGrid: false,
        snapEnabled: false,
        selectedTool: 'select',
        zoom: 1,
        panX: 0,
        panY: 0,
    };
}
