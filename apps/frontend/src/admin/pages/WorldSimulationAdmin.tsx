import React, { useEffect, useState } from 'react';
import {
  useWorldArchetypes,
  useWorldRoutes,
  useWorldSpawnRules,
  useActiveWorldEntities,
  useWorldMapZones,
  useWorldSnapshot,
} from '../../services/useWorldSimulation';
import { getContentSnapshot } from '../../services/content/contentApi';
import { imageService } from '../../services/content/imageService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  DEFAULT_WORLD_MAP_RUNTIME_SETTINGS,
  clearWorldMapRuntimeSettings,
  loadWorldMapRuntimeSettings,
  saveWorldMapRuntimeSettings,
} from '../../worldmap/worldMapRuntimeSettings';
import './WorldSimulationAdmin.css';

/**
 * Админ-страничка для управления живой симуляцией мира.
 * Вкладки: Архетипы, Маршруты, Правила спавна, Монитор активных сущностей.
 */
export function WorldSimulationAdmin() {
  const [activeTab, setActiveTab] = useState<'archetypes' | 'routes' | 'rules' | 'monitor'>('archetypes');

  return (
    <div className="world-simulation-admin">
      <h2>🌍 Симуляция Живого Мира</h2>

      <div className="admin-tabs">
        <button
          className={activeTab === 'archetypes' ? 'active' : ''}
          onClick={() => setActiveTab('archetypes')}
        >
          Архетипы NPC
        </button>
        <button className={activeTab === 'routes' ? 'active' : ''} onClick={() => setActiveTab('routes')}>
          Маршруты
        </button>
        <button className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>
          Правила спавна
        </button>
        <button className={activeTab === 'monitor' ? 'active' : ''} onClick={() => setActiveTab('monitor')}>
          Монитор
        </button>
      </div>

      <LiveWorldRuntimeTuningPanel />

      {activeTab === 'archetypes' && <ArchetypesTab />}
      {activeTab === 'routes' && <RoutesTab />}
      {activeTab === 'rules' && <SpawnRulesTab />}
      {activeTab === 'monitor' && <MonitorTab />}
    </div>
  );
}

function LiveWorldRuntimeTuningPanel() {
  const initialSettings = loadWorldMapRuntimeSettings();
  const [npcSpeedScale, setNpcSpeedScale] = useState(String(initialSettings.phaserNpcMoveSpeedScale));
  const [npcTweenMinMs, setNpcTweenMinMs] = useState(String(initialSettings.phaserNpcMoveTweenMinMs));
  const [npcTweenMaxMs, setNpcTweenMaxMs] = useState(String(initialSettings.phaserNpcMoveTweenMaxMs));
  const [status, setStatus] = useState('Не сохранено');

  function handleSave() {
    const speedScale = Number(npcSpeedScale);
    const tweenMinMs = Number(npcTweenMinMs);
    const tweenMaxMs = Number(npcTweenMaxMs);

    if (!Number.isFinite(speedScale) || !Number.isFinite(tweenMinMs) || !Number.isFinite(tweenMaxMs)) {
      setStatus('Ошибка: все поля должны быть числовыми.');
      return;
    }

    const saved = saveWorldMapRuntimeSettings({
      phaserNpcMoveSpeedScale: speedScale,
      phaserNpcMoveTweenMinMs: tweenMinMs,
      phaserNpcMoveTweenMaxMs: tweenMaxMs,
    });

    setNpcSpeedScale(String(saved.phaserNpcMoveSpeedScale));
    setNpcTweenMinMs(String(saved.phaserNpcMoveTweenMinMs));
    setNpcTweenMaxMs(String(saved.phaserNpcMoveTweenMaxMs));
    setStatus('Сохранено. Phaser-NPC движение обновлено.');
  }

  function handleReset() {
    clearWorldMapRuntimeSettings();
    const defaults = DEFAULT_WORLD_MAP_RUNTIME_SETTINGS;
    setNpcSpeedScale(String(defaults.phaserNpcMoveSpeedScale));
    setNpcTweenMinMs(String(defaults.phaserNpcMoveTweenMinMs));
    setNpcTweenMaxMs(String(defaults.phaserNpcMoveTweenMaxMs));
    setStatus('Сброшено к значениям по умолчанию.');
  }

  return (
    <div className="runtime-tuning-panel">
      <h3>Настройка движения NPC (Phaser)</h3>
      <p className="muted">Регулирует визуальную скорость и плавность перемещения NPC на карте мира в Phaser.</p>
      <div className="runtime-tuning-grid">
        <label>
          Скорость NPC относительно героя (0.5 - 2.5)
          <input
            type="number"
            step="0.05"
            min="0.5"
            max="2.5"
            value={npcSpeedScale}
            onChange={(event) => setNpcSpeedScale(event.target.value)}
          />
        </label>
        <label>
          Минимальная длительность шага (ms)
          <input
            type="number"
            step="5"
            min="16"
            max="240"
            value={npcTweenMinMs}
            onChange={(event) => setNpcTweenMinMs(event.target.value)}
          />
        </label>
        <label>
          Максимальная длительность шага (ms)
          <input
            type="number"
            step="10"
            min="120"
            max="2000"
            value={npcTweenMaxMs}
            onChange={(event) => setNpcTweenMaxMs(event.target.value)}
          />
        </label>
      </div>
      <div className="runtime-tuning-actions">
        <button type="button" className="btn btn-success" onClick={handleSave}>Сохранить движение NPC</button>
        <button type="button" className="btn btn-cancel" onClick={handleReset}>Сбросить</button>
      </div>
      <p className="muted">Статус: {status}</p>
    </div>
  );
}

/**
 * Вкладка Архетипы.
 */
function ArchetypesTab() {
  const { archetypes, create, update, remove } = useWorldArchetypes();
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [npcOptions, setNpcOptions] = useState<any[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<any[]>([]);
  const [uploadingSprite, setUploadingSprite] = useState(false);
  const [uploadingRestingSprite, setUploadingRestingSprite] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const refreshSourceOptions = () => {
    getContentSnapshot()
      .then((snapshot) => {
        setNpcOptions(snapshot.npcs ?? []);
        setMerchantOptions((snapshot.merchants ?? []).filter((merchant: any) => merchant.worldSimTrader));
      })
      .catch(() => {
        setNpcOptions([]);
        setMerchantOptions([]);
      });
  };

  useEffect(() => {
    refreshSourceOptions();
  }, []);

  useEffect(() => {
    if (editing) {
      refreshSourceOptions();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing || !formData?.sourceId) {
      return;
    }

    setFormData((current: any) => applySource((current.sourceType ?? 'npc') as 'npc' | 'merchant', current.sourceId ?? '', current));
  }, [editing, merchantOptions, npcOptions]);

  const applyKindDefaults = (kind: string, current: any) => {
    if (kind === 'merchant') {
      return {
        ...current,
        kind,
        worldSpriteId: 'trader_world_sprite',
        portraitId: current.portraitId || 'unknown',
      };
    }

    if (kind === 'bandit') {
      return {
        ...current,
        kind,
        worldSpriteId: 'camp_world_sprite',
        restingWorldSpriteId: current.restingWorldSpriteId || 'fire_world_sprite',
        portraitId: current.portraitId || 'unknown',
      };
    }

    return { ...current, kind };
  };

  const shouldReplacePortrait = (portraitId: unknown) => {
    const normalized = String(portraitId ?? '').trim().toLowerCase();
    return normalized === '' || normalized === 'unknown' || normalized === '/assets/placeholders/unknown_portrait.png';
  };

  const resolveSourceVisuals = (sourceType: 'npc' | 'merchant', sourceId: string) => {
    if (!sourceId) {
      return { portraitId: undefined, merchantId: undefined };
    }

    if (sourceType === 'npc') {
      const npc = npcOptions.find((entry) => entry.id === sourceId);
      if (!npc) {
        return { portraitId: undefined, merchantId: undefined };
      }

      const portraitId = [npc.portraitUrl, npc.iconUrl, npc.fullImageUrl]
        .map((value: unknown) => String(value ?? '').trim())
        .find(Boolean);

      return {
        portraitId,
        merchantId: String(npc.traderId ?? '').trim() || undefined,
      };
    }

    const merchant = merchantOptions.find((entry) => entry.id === sourceId);
    if (!merchant) {
      return { portraitId: undefined, merchantId: undefined };
    }

    const portraitId = [merchant.portraitPath, merchant.iconUrl, merchant.imagePath]
      .map((value: unknown) => String(value ?? '').trim())
      .find(Boolean);

    return {
      portraitId,
      merchantId: merchant.id,
    };
  };

  const applySource = (sourceType: 'npc' | 'merchant', sourceId: string, current: any) => {
    const resolved = resolveSourceVisuals(sourceType, sourceId);
    return {
      ...current,
      sourceType,
      sourceId,
      npcTemplateId: sourceType === 'npc' ? sourceId : undefined,
      merchantId: sourceType === 'merchant' ? sourceId : (resolved.merchantId ?? current.merchantId),
      portraitId: shouldReplacePortrait(current.portraitId)
        ? (resolved.portraitId ?? current.portraitId)
        : current.portraitId,
    };
  };

  const handleNew = () => {
    setEditing('_new');
    setFormData({
      id: `archetype_${Date.now()}`,
      name: 'Новый архетип',
      kind: 'merchant',
      sourceType: 'merchant',
      sourceId: '',
      npcTemplateId: '',
      merchantId: '',
      worldSpriteId: 'trader_world_sprite',
      restingWorldSpriteId: '',
      isEnabled: true,
    });
  };

  const handleSave = async () => {
    const payload = applySource(formData.sourceType ?? 'npc', formData.sourceId ?? '', formData);
    if (editing === '_new') {
      await create(payload);
    } else if (editing) {
      await update(editing, payload);
    }
    setEditing(null);
  };

  const handleEdit = (arch: any) => {
    setEditing(arch.id);
    setFormData({
      ...arch,
      sourceType: arch.sourceType ?? (arch.merchantId ? 'merchant' : 'npc'),
      sourceId: arch.sourceId ?? arch.merchantId ?? arch.npcTemplateId ?? '',
    });
  };

  const handleDelete = async (arch: any) => {
    const accepted = window.confirm(`Удалить архетип ${arch.name} (${arch.id})?\n\nСвязи в маршрутах и spawn-правилах будут очищены автоматически.`);
    if (!accepted) {
      return;
    }

    const result = await remove(arch.id);
    if (!result.success) {
      window.alert('Архетип не найден или уже удалён.');
      return;
    }

    if (editing === arch.id) {
      setEditing(null);
    }

    window.alert(
      `Архетип удалён.\nАктивных сущностей удалено: ${result.removedActiveEntities}.\nОбновлено маршрутов: ${result.updatedRoutes}.\nОбновлено spawn-правил: ${result.updatedSpawnRules}.`,
    );
  };

  const handleSpriteUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      setUploadError(null);
      setUploadingSprite(true);
      const stored = await imageService.upload(file, {
        id: formData.id ? `${formData.id}_world_sprite` : undefined,
        name: `${formData.id || 'archetype'}-world-sprite`,
        folder: buildUploadFolder('images', 'worldsim', 'archetypes', formData.id || undefined),
      });
      setFormData((prev: any) => ({ ...prev, worldSpriteId: stored.id }));
    } catch {
      setUploadError('Не удалось загрузить спрайт. Попробуй другой файл PNG/JPG.');
    } finally {
      setUploadingSprite(false);
    }
  };

  const handleRestingSpriteUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      setUploadError(null);
      setUploadingRestingSprite(true);
      const stored = await imageService.upload(file, {
        id: formData.id ? `${formData.id}_resting_world_sprite` : undefined,
        name: `${formData.id || 'archetype'}-resting-world-sprite`,
        folder: buildUploadFolder('images', 'worldsim', 'archetypes', formData.id || undefined),
      });
      setFormData((prev: any) => ({ ...prev, restingWorldSpriteId: stored.id }));
    } catch {
      setUploadError('Не удалось загрузить спрайт отдыха. Попробуй другой файл PNG/JPG.');
    } finally {
      setUploadingRestingSprite(false);
    }
  };

  const handlePortraitUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      setUploadError(null);
      setUploadingPortrait(true);
      const stored = await imageService.upload(file, {
        id: formData.id ? `${formData.id}_portrait` : undefined,
        name: `${formData.id || 'archetype'}-portrait`,
        folder: buildUploadFolder('images', 'worldsim', 'archetypes', formData.id || undefined),
      });
      setFormData((prev: any) => ({ ...prev, portraitId: stored.id }));
    } catch {
      setUploadError('Не удалось загрузить портрет. Попробуй другой файл PNG/JPG.');
    } finally {
      setUploadingPortrait(false);
    }
  };

  return (
    <div className="admin-tab-content">
      <p className="muted">Архетип сам по себе не появляется на карте. Для спрайта в мире нужны ещё маршрут, где этот archetype разрешён, и активное spawn rule.</p>
      <button onClick={handleNew} className="btn btn-primary">
        ➕ Создать архетип
      </button>

      {editing && (
        <div className="edit-form">
          <h3>Редактирование архетипа</h3>
          <label>
            ID:
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={editing !== '_new'}
            />
          </label>
          <label>
            Имя:
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </label>
          <label>
            Тип:
            <select
              value={formData.kind}
              onChange={(e) => setFormData(applyKindDefaults(e.target.value, formData))}
            >
              <option value="merchant">Торговец</option>
              <option value="guard">Охранник</option>
              <option value="bandit">Бандит</option>
              <option value="monk">Монах</option>
              <option value="wanderer">Странник</option>
              <option value="mage">Маг</option>
              <option value="quest_giver">Квестодатель</option>
              <option value="warrior">Воин</option>
              <option value="creature">Существо</option>
              <option value="event">Событие / лагерь</option>
            </select>
          </label>
          <label>
            Источник:
            <select value={formData.sourceType ?? 'npc'} onChange={(e) => setFormData(applySource(e.target.value as 'npc' | 'merchant', '', formData))}>
              <option value="npc">NPC</option>
              <option value="merchant">Торговец</option>
            </select>
          </label>
          <label>
            ID источника:
            <select value={formData.sourceId ?? ''} onChange={(e) => setFormData(applySource((formData.sourceType ?? 'npc') as 'npc' | 'merchant', e.target.value, formData))}>
              <option value="">-- выбрать --</option>
              {(formData.sourceType ?? 'npc') === 'merchant'
                ? merchantOptions.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name} ({merchant.id})</option>)
                : npcOptions.map((npc) => <option key={npc.id} value={npc.id}>{npc.name} ({npc.id})</option>)}
            </select>
          </label>
          <label>
            ID вручную:
            <input
              type="text"
              value={formData.sourceId ?? ''}
              onChange={(e) => setFormData(applySource((formData.sourceType ?? 'npc') as 'npc' | 'merchant', e.target.value, formData))}
              placeholder={(formData.sourceType ?? 'npc') === 'merchant' ? 'merchant_id' : 'npc_id'}
            />
          </label>
          <label>
            Спрайт:
            <select value={formData.worldSpriteId} onChange={(e) => setFormData({ ...formData, worldSpriteId: e.target.value })}>
              <option value="trader_world_sprite">Торговец</option>
              <option value="camp_world_sprite">Лагерь</option>
              <option value="camp_world_sprite_2">Лагерь 2</option>
              <option value="fire_world_sprite">Костер</option>
            </select>
          </label>
          <label>
            Загрузить свой спрайт мира:
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleSpriteUpload(file);
                e.currentTarget.value = '';
              }}
            />
            <small>
              {uploadingSprite
                ? 'Загрузка спрайта...'
                : `Текущий worldSpriteId: ${formData.worldSpriteId || 'не задан'}`}
            </small>
          </label>
          <label>
            Спрайт отдыха:
            <select
              value={formData.restingWorldSpriteId ?? ''}
              onChange={(e) => setFormData({ ...formData, restingWorldSpriteId: e.target.value || undefined })}
            >
              <option value="">Как основной спрайт</option>
              <option value="fire_world_sprite">Костер</option>
              <option value="camp_world_sprite">Лагерь</option>
              <option value="camp_world_sprite_2">Лагерь 2</option>
              <option value="trader_world_sprite">Торговец</option>
            </select>
          </label>
          <label>
            Загрузить свой спрайт отдыха:
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleRestingSpriteUpload(file);
                e.currentTarget.value = '';
              }}
            />
            <small>
              {uploadingRestingSprite
                ? 'Загрузка спрайта отдыха...'
                : `Текущий restingWorldSpriteId: ${formData.restingWorldSpriteId || 'не задан'}`}
            </small>
          </label>
          <label>
            Портрет ID:
            <input
              type="text"
              value={formData.portraitId ?? ''}
              onChange={(e) => setFormData({ ...formData, portraitId: e.target.value })}
              placeholder="unknown или img_xxx"
            />
          </label>
          <label>
            Загрузить свой портрет:
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handlePortraitUpload(file);
                e.currentTarget.value = '';
              }}
            />
            <small>
              {uploadingPortrait
                ? 'Загрузка портрета...'
                : `Текущий portraitId: ${formData.portraitId || 'не задан'}`}
            </small>
          </label>
          {uploadError && <small style={{ color: '#a00' }}>{uploadError}</small>}
          <label>
            Включен:
            <input
              type="checkbox"
              checked={Boolean(formData.isEnabled)}
              onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
            />
          </label>

          <div className="form-actions">
            <button onClick={handleSave} className="btn btn-success">
              ✓ Сохранить
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-cancel">
              ✗ Отмена
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {archetypes.map((arch) => (
          <div key={arch.id} className="list-item">
            <div className="item-header">
              <strong>{arch.name}</strong>
              <span className="badge">{arch.kind}</span>
              {!arch.isEnabled && <span className="badge disabled">отключен</span>}
              <button
                className="btn btn-secondary"
                onClick={() => handleEdit(arch)}
                style={{ marginLeft: 'auto' }}
              >
                ✏️ Редактировать
              </button>
              <button
                className="btn btn-danger"
                onClick={() => void handleDelete(arch)}
              >
                🗑 Удалить
              </button>
            </div>
            <div className="item-details">
              <small>ID: {arch.id}</small>
              <small>Спрайт: {arch.worldSpriteId}</small>
              <small>Отдых: {arch.restingWorldSpriteId || 'как основной'}</small>
              <small>Источник: {arch.sourceType ?? (arch.merchantId ? 'merchant' : 'npc')} / {arch.sourceId ?? arch.merchantId ?? arch.npcTemplateId ?? '-'}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Вкладка Маршруты.
 */
function RoutesTab() {
  const { routes, create, update } = useWorldRoutes();
  const { archetypes } = useWorldArchetypes();
  const { zones } = useWorldMapZones();
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [waypointDraft, setWaypointDraft] = useState({ zoneId: '', cityId: '', stopMin: '60', stopMax: '180' });
  const [archetypeDraft, setArchetypeDraft] = useState('');

  const parseWaypoints = (value: string) => {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [zoneId, cityId, stopMin, stopMax] = line.split(',').map((p) => p.trim());
        const waypoint: any = { zoneId };
        if (cityId) waypoint.cityId = cityId;
        if (stopMin) waypoint.stopDurationMin = Number(stopMin);
        if (stopMax) waypoint.stopDurationMax = Number(stopMax);
        return waypoint;
      });
  };

  const toWaypointsText = (waypoints: any[]) => {
    return (waypoints ?? [])
      .map((w) => [w.zoneId ?? '', w.cityId ?? '', w.stopDurationMin ?? '', w.stopDurationMax ?? ''].join(','))
      .join('\n');
  };

  const handleNew = () => {
    setEditing('_new');
    setFormData({
      id: `route_${Date.now()}`,
      name: 'Новый маршрут',
      waypointsText: 'arklein,arklein,60,180\ncity_grankor,city_grankor,90,200',
      travelTimingDevMinutes: 10,
      travelTimingReleaseHours: 6,
      dangerLevel: 3,
      restChance: 0.25,
      allowedArchetypesText: 'caravan_arklein_mirel',
      isActive: true,
    });
  };

  const handleEdit = (route: any) => {
    setEditing(route.id);
    setFormData({
      ...route,
      waypointsText: toWaypointsText(route.waypoints),
      allowedArchetypesText: (route.allowedArchetypes ?? []).join(', '),
    });
  };

  const addWaypointFromDraft = () => {
    if (!waypointDraft.zoneId) {
      return;
    }
    const line = [
      waypointDraft.zoneId,
      waypointDraft.cityId,
      waypointDraft.stopMin,
      waypointDraft.stopMax,
    ].join(',');
    const next = [formData.waypointsText ?? '', line].filter(Boolean).join('\n');
    setFormData({ ...formData, waypointsText: next });
  };

  const addArchetypeFromDraft = () => {
    if (!archetypeDraft) {
      return;
    }
    const current = (formData.allowedArchetypesText ?? '')
      .split(',')
      .map((v: string) => v.trim())
      .filter(Boolean);
    if (!current.includes(archetypeDraft)) {
      current.push(archetypeDraft);
    }
    setFormData({ ...formData, allowedArchetypesText: current.join(', ') });
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      waypoints: parseWaypoints(formData.waypointsText ?? ''),
      allowedArchetypes: (formData.allowedArchetypesText ?? '')
        .split(',')
        .map((v: string) => v.trim())
        .filter(Boolean),
      travelTimingDevMinutes: Number(formData.travelTimingDevMinutes),
      travelTimingReleaseHours: Number(formData.travelTimingReleaseHours),
      dangerLevel: Number(formData.dangerLevel),
      restChance: Number(formData.restChance),
      isActive: Boolean(formData.isActive),
    } as any;

    delete payload.waypointsText;
    delete payload.allowedArchetypesText;

    if (editing === '_new') {
      await create(payload);
    } else if (editing) {
      await update(editing, payload);
    }

    setEditing(null);
  };

  return (
    <div className="admin-tab-content">
      <button onClick={handleNew} className="btn btn-primary">
        ➕ Создать маршрут
      </button>

      {editing && (
        <div className="edit-form">
          <h3>{editing === '_new' ? 'Создание маршрута' : 'Редактирование маршрута'}</h3>
          <label>
            ID:
            <input
              type="text"
              value={formData.id ?? ''}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={editing !== '_new'}
            />
          </label>
          <label>
            Имя:
            <input
              type="text"
              value={formData.name ?? ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </label>
          <label>
            Узлы (формат: zoneId,cityId,stopMin,stopMax; по одному на строку):
            <textarea
              rows={4}
              value={formData.waypointsText ?? ''}
              onChange={(e) => setFormData({ ...formData, waypointsText: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 220px' }}>
              Zone ID:
              <select
                value={waypointDraft.zoneId}
                onChange={(e) => {
                  const zoneId = e.target.value;
                  const zone = zones.find((z: any) => z.id === zoneId);
                  setWaypointDraft({
                    ...waypointDraft,
                    zoneId,
                    cityId: zone?.cityId ?? '',
                  });
                }}
              >
                <option value="">-- выбрать зону --</option>
                {zones.map((z: any) => (
                  <option key={z.id} value={z.id}>
                    {z.id} {z.name ? `(${z.name})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: '1 1 180px' }}>
              City ID:
              <input
                type="text"
                value={waypointDraft.cityId}
                onChange={(e) => setWaypointDraft({ ...waypointDraft, cityId: e.target.value })}
              />
            </label>
            <label style={{ width: 120 }}>
              Stop Min:
              <input
                type="number"
                value={waypointDraft.stopMin}
                onChange={(e) => setWaypointDraft({ ...waypointDraft, stopMin: e.target.value })}
              />
            </label>
            <label style={{ width: 120 }}>
              Stop Max:
              <input
                type="number"
                value={waypointDraft.stopMax}
                onChange={(e) => setWaypointDraft({ ...waypointDraft, stopMax: e.target.value })}
              />
            </label>
            <button type="button" className="btn btn-secondary" onClick={addWaypointFromDraft}>
              + Добавить узел
            </button>
          </div>
          <label>
            Разрешенные архетипы (через запятую):
            <input
              type="text"
              value={formData.allowedArchetypesText ?? ''}
              onChange={(e) => setFormData({ ...formData, allowedArchetypesText: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 260px' }}>
              Добавить архетип:
              <select value={archetypeDraft} onChange={(e) => setArchetypeDraft(e.target.value)}>
                <option value="">-- выбрать архетип --</option>
                {archetypes.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.id} ({a.name})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-secondary" onClick={addArchetypeFromDraft}>
              + Добавить архетип
            </button>
          </div>
          <label>
            Время dev (мин):
            <input
              type="number"
              value={formData.travelTimingDevMinutes ?? 10}
              onChange={(e) => setFormData({ ...formData, travelTimingDevMinutes: e.target.value })}
            />
          </label>
          <label>
            Время release (часы):
            <input
              type="number"
              value={formData.travelTimingReleaseHours ?? 6}
              onChange={(e) => setFormData({ ...formData, travelTimingReleaseHours: e.target.value })}
            />
          </label>
          <label>
            Опасность (0-10):
            <input
              type="number"
              min={0}
              max={10}
              value={formData.dangerLevel ?? 3}
              onChange={(e) => setFormData({ ...formData, dangerLevel: e.target.value })}
            />
          </label>
          <label>
            Шанс отдыха (0-1):
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={formData.restChance ?? 0.25}
              onChange={(e) => setFormData({ ...formData, restChance: e.target.value })}
            />
          </label>
          <label>
            Активен:
            <input
              type="checkbox"
              checked={Boolean(formData.isActive)}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
          </label>

          <div className="form-actions">
            <button onClick={handleSave} className="btn btn-success">
              ✓ Сохранить
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-cancel">
              ✗ Отмена
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {routes.map((route) => (
          <div key={route.id} className="list-item">
            <div className="item-header">
              <strong>{route.name}</strong>
              <span className="badge">маршрут</span>
              <button
                className="btn btn-secondary"
                onClick={() => handleEdit(route)}
                style={{ marginLeft: 'auto' }}
              >
                ✏️ Редактировать
              </button>
            </div>
            <div className="item-details">
              <small>Узлов: {route.waypoints.length}</small>
              <small>Опасность: {route.dangerLevel}/10</small>
              <small>Статус: {route.isActive ? '🟢 активен' : '🔴 отключен'}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Вкладка Правила спавна.
 */
function SpawnRulesTab() {
  const { rules, create, update } = useWorldSpawnRules();
  const { archetypes } = useWorldArchetypes();
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [archetypeDraft, setArchetypeDraft] = useState('');

  const handleNew = () => {
    setEditing('_new');
    setFormData({
      id: `spawn_${Date.now()}`,
      name: 'Новое правило спавна',
      spawnType: 'time_based',
      spawnTimeDevMinutes: 5,
      spawnTimeReleaseHours: 24,
      archetypeIdsText: 'caravan_arklein_mirel',
      minGroupSize: 1,
      maxGroupSize: 1,
      spawnWeight: 0.7,
      cooldownDev: 10,
      cooldownRelease: 24,
      conditionPriceCategory: '',
      conditionMinPrice: '',
      conditionCityId: '',
      conditionSupplyDeficit: false,
      isActive: true,
    });
  };

  const handleEdit = (rule: any) => {
    setEditing(rule.id);
    setFormData({
      ...rule,
      archetypeIdsText: (rule.archetypeIds ?? []).join(', '),
      conditionPriceCategory: rule.conditions?.priceCategory ?? '',
      conditionMinPrice: rule.conditions?.minPrice ?? '',
      conditionCityId: rule.conditions?.cityId ?? '',
      conditionSupplyDeficit: Boolean(rule.conditions?.supplyDeficit),
    });
  };

  const handleSave = async () => {
    const conditions: any = {};
    if (formData.conditionPriceCategory) conditions.priceCategory = formData.conditionPriceCategory;
    if (formData.conditionMinPrice !== '' && formData.conditionMinPrice !== null) {
      conditions.minPrice = Number(formData.conditionMinPrice);
    }
    if (formData.conditionCityId) conditions.cityId = formData.conditionCityId;
    if (formData.conditionSupplyDeficit) conditions.supplyDeficit = true;

    const payload: any = {
      ...formData,
      archetypeIds: (formData.archetypeIdsText ?? '')
        .split(',')
        .map((v: string) => v.trim())
        .filter(Boolean),
      minGroupSize: Number(formData.minGroupSize),
      maxGroupSize: Number(formData.maxGroupSize),
      spawnWeight: Number(formData.spawnWeight),
      spawnTimeDevMinutes: Number(formData.spawnTimeDevMinutes),
      spawnTimeReleaseHours: Number(formData.spawnTimeReleaseHours),
      cooldownDev: Number(formData.cooldownDev),
      cooldownRelease: Number(formData.cooldownRelease),
      isActive: Boolean(formData.isActive),
    };

    if (Object.keys(conditions).length > 0) {
      payload.conditions = conditions;
    } else {
      delete payload.conditions;
    }

    delete payload.archetypeIdsText;
    delete payload.conditionPriceCategory;
    delete payload.conditionMinPrice;
    delete payload.conditionCityId;
    delete payload.conditionSupplyDeficit;

    if (editing === '_new') {
      await create(payload);
    } else if (editing) {
      await update(editing, payload);
    }

    setEditing(null);
  };

  const addArchetypeFromDraft = () => {
    if (!archetypeDraft) {
      return;
    }
    const current = (formData.archetypeIdsText ?? '')
      .split(',')
      .map((v: string) => v.trim())
      .filter(Boolean);
    if (!current.includes(archetypeDraft)) {
      current.push(archetypeDraft);
    }
    setFormData({ ...formData, archetypeIdsText: current.join(', ') });
  };

  return (
    <div className="admin-tab-content">
      <button onClick={handleNew} className="btn btn-primary">
        ➕ Создать правило спавна
      </button>

      {editing && (
        <div className="edit-form">
          <h3>{editing === '_new' ? 'Создание правила спавна' : 'Редактирование правила спавна'}</h3>
          <label>
            ID:
            <input
              type="text"
              value={formData.id ?? ''}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={editing !== '_new'}
            />
          </label>
          <label>
            Имя:
            <input
              type="text"
              value={formData.name ?? ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </label>
          <label>
            Тип:
            <select
              value={formData.spawnType ?? 'time_based'}
              onChange={(e) => setFormData({ ...formData, spawnType: e.target.value })}
            >
              <option value="time_based">time_based</option>
              <option value="event_based">event_based</option>
              <option value="economy_based">economy_based</option>
            </select>
          </label>
          <label>
            Архетипы (через запятую):
            <input
              type="text"
              value={formData.archetypeIdsText ?? ''}
              onChange={(e) => setFormData({ ...formData, archetypeIdsText: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 260px' }}>
              Добавить архетип:
              <select value={archetypeDraft} onChange={(e) => setArchetypeDraft(e.target.value)}>
                <option value="">-- выбрать архетип --</option>
                {archetypes.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.id} ({a.name})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-secondary" onClick={addArchetypeFromDraft}>
              + Добавить архетип
            </button>
          </div>
          <label>
            Интервал dev (мин):
            <input
              type="number"
              value={formData.spawnTimeDevMinutes ?? 5}
              onChange={(e) => setFormData({ ...formData, spawnTimeDevMinutes: e.target.value })}
            />
          </label>
          <label>
            Интервал release (часы):
            <input
              type="number"
              value={formData.spawnTimeReleaseHours ?? 24}
              onChange={(e) => setFormData({ ...formData, spawnTimeReleaseHours: e.target.value })}
            />
          </label>
          <label>
            Размер группы min/max:
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={formData.minGroupSize ?? 1}
                onChange={(e) => setFormData({ ...formData, minGroupSize: e.target.value })}
              />
              <input
                type="number"
                value={formData.maxGroupSize ?? 1}
                onChange={(e) => setFormData({ ...formData, maxGroupSize: e.target.value })}
              />
            </div>
          </label>
          <label>
            Вероятность (0..1):
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={formData.spawnWeight ?? 0.7}
              onChange={(e) => setFormData({ ...formData, spawnWeight: e.target.value })}
            />
          </label>
          <label>
            Cooldown dev/release:
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={formData.cooldownDev ?? 10}
                onChange={(e) => setFormData({ ...formData, cooldownDev: e.target.value })}
              />
              <input
                type="number"
                value={formData.cooldownRelease ?? 24}
                onChange={(e) => setFormData({ ...formData, cooldownRelease: e.target.value })}
              />
            </div>
          </label>
          <label>
            Conditions.priceCategory:
            <input
              type="text"
              value={formData.conditionPriceCategory ?? ''}
              onChange={(e) => setFormData({ ...formData, conditionPriceCategory: e.target.value })}
            />
          </label>
          <label>
            Conditions.minPrice:
            <input
              type="number"
              value={formData.conditionMinPrice ?? ''}
              onChange={(e) => setFormData({ ...formData, conditionMinPrice: e.target.value })}
            />
          </label>
          <label>
            Conditions.cityId:
            <input
              type="text"
              value={formData.conditionCityId ?? ''}
              onChange={(e) => setFormData({ ...formData, conditionCityId: e.target.value })}
            />
          </label>
          <label>
            Conditions.supplyDeficit:
            <input
              type="checkbox"
              checked={Boolean(formData.conditionSupplyDeficit)}
              onChange={(e) => setFormData({ ...formData, conditionSupplyDeficit: e.target.checked })}
            />
          </label>
          <label>
            Активно:
            <input
              type="checkbox"
              checked={Boolean(formData.isActive)}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
          </label>

          <div className="form-actions">
            <button onClick={handleSave} className="btn btn-success">
              ✓ Сохранить
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-cancel">
              ✗ Отмена
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {rules.map((rule) => (
          <div key={rule.id} className="list-item">
            <div className="item-header">
              <strong>{rule.name}</strong>
              <span className="badge">{rule.spawnType}</span>
              <button
                className="btn btn-secondary"
                onClick={() => handleEdit(rule)}
                style={{ marginLeft: 'auto' }}
              >
                ✏️ Редактировать
              </button>
            </div>
            <div className="item-details">
              <small>Архетипов: {rule.archetypeIds.length}</small>
              <small>Размер группы: {rule.minGroupSize}-{rule.maxGroupSize}</small>
              <small>Вероятность: {(rule.spawnWeight * 100).toFixed(0)}%</small>
              <small>Статус: {rule.isActive ? '🟢 активно' : '🔴 отключено'}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Вкладка Монитор - просмотр активных сущностей и GM commands.
 */
function MonitorTab() {
  const { entities, killEntity, freezeEntity, refresh } = useActiveWorldEntities();
  const { snapshot } = useWorldSnapshot();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const visibleCount = snapshot?.activeEntities?.length ?? 0;
  const totalCount = entities.length;

  return (
    <div className="admin-tab-content monitor-tab">
      <div className="monitor-controls">
        <button onClick={refresh} className="btn btn-secondary">
          🔄 Обновить
        </button>
        <p>Активных сущностей (total): {totalCount}</p>
        <p>Видимых игроку (visible): {visibleCount}</p>
      </div>

      <div className="monitor-list">
        {entities.map((entity) => (
          <div
            key={entity.id}
            className={`monitor-item ${selectedEntity === entity.id ? 'selected' : ''}`}
            onClick={() => setSelectedEntity(selectedEntity === entity.id ? null : entity.id)}
          >
            <div className="monitor-item-header">
              <strong>{entity.archetypeId}</strong>
              <span className={`status-badge ${entity.state}`}>{entity.state}</span>
            </div>
            <div className="monitor-item-details">
              <small>ID: {entity.id}</small>
              <small>Участников: {entity.members.length}</small>
              <small>Прогресс маршрута: {(entity.routeProgress * 100).toFixed(1)}%</small>
            </div>

            {selectedEntity === entity.id && (
              <div className="monitor-item-actions">
                <button
                  onClick={() => killEntity(entity.id)}
                  className="btn btn-danger"
                  title="Убить сущность (заморозить на 24ч)"
                >
                  💀 Убить
                </button>
                <button
                  onClick={() => freezeEntity(entity.id, 1)}
                  className="btn btn-warning"
                  title="Заморозить на 1 час"
                >
                  ❄️ Заморозить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorldSimulationAdmin;
