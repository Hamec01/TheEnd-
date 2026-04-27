import { ZONE_COLORS } from './zoneColors';
import { REGION_TYPE_COLORS } from './regionPaintSystem';
import type { RegionBrushSize, RegionToolMode, RegionType, WorldMapZone, ZoneEditorDraft, ZoneEditorSettings, ZoneEditorTool, ZoneType } from './zoneEditorTypes';

const ZONE_TYPE_OPTIONS: ZoneType[] = [
  'city',
  'settlement',
  'quest',
  'story',
  'landmark',
  'danger',
  'grind',
  'resource',
  'profession',
  'dungeon',
  'transition',
  'safe',
  'event',
  'faction',
  'locked',
  'fast_travel',
  'rest',
];

const TOOL_OPTIONS: Array<{ value: ZoneEditorTool; label: string }> = [
  { value: 'select', label: 'Select Tool' },
  { value: 'circle', label: 'Circle Tool' },
  { value: 'polygon', label: 'Polygon Tool' },
  { value: 'rectangle', label: 'Rectangle Tool' },
  { value: 'pan', label: 'Move / Pan Tool' },
  { value: 'measure', label: 'Measure Tool' },
];

const REGION_TOOL_OPTIONS: Array<{ value: RegionToolMode; label: string }> = [
  { value: 'circle', label: 'Circle' },
  { value: 'pencil', label: 'Pencil' },
  { value: 'eraser', label: 'Eraser' },
];

const REGION_TYPE_OPTIONS: RegionType[] = ['blocked', 'water', 'road', 'danger', 'trigger', 'walkable'];

const BRUSH_SIZE_OPTIONS: RegionBrushSize[] = [1, 2, 3, 5];

interface ZoneEditorPanelProps {
  draft: ZoneEditorDraft | null;
  zones: WorldMapZone[];
  selectedZoneId: string | null;
  selectedTool: ZoneEditorTool;
  settings: ZoneEditorSettings;
  jsonValue: string;
  validationErrors: string[];
  regionToolMode: RegionToolMode;
  regionType: RegionType;
  regionBrushSize: RegionBrushSize;
  onRegionToolModeChange: (tool: RegionToolMode) => void;
  onRegionTypeChange: (type: RegionType) => void;
  onRegionBrushSizeChange: (size: RegionBrushSize) => void;
  onToolChange: (tool: ZoneEditorTool) => void;
  onSettingsChange: (patch: Partial<ZoneEditorSettings>) => void;
  onDraftChange: (draft: ZoneEditorDraft | null) => void;
  onSaveNewZone: () => void;
  onUpdateSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearDraft: () => void;
  onClearAll: () => void;
  onResetStorage: () => void;
  onExport: () => void;
  onCopyJson: () => void;
  onImportJson: () => void;
  onValidateJson: () => void;
  onJsonChange: (value: string) => void;
  onDeleteSelectedPoint: () => void;
  onReversePoints: () => void;
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ZoneEditorPanel(props: ZoneEditorPanelProps) {
  const {
    draft,
    zones,
    selectedZoneId,
    selectedTool,
    settings,
    jsonValue,
    validationErrors,
    regionToolMode,
    regionType,
    regionBrushSize,
    onRegionToolModeChange,
    onRegionTypeChange,
    onRegionBrushSizeChange,
    onToolChange,
    onSettingsChange,
    onDraftChange,
    onSaveNewZone,
    onUpdateSelected,
    onDuplicateSelected,
    onDeleteSelected,
    onClearDraft,
    onClearAll,
    onResetStorage,
    onExport,
    onCopyJson,
    onImportJson,
    onValidateJson,
    onJsonChange,
    onDeleteSelectedPoint,
    onReversePoints,
  } = props;

  const hasDraft = Boolean(draft);
  const hasSelectedZone = Boolean(selectedZoneId);

  function updateDraft(patch: Partial<ZoneEditorDraft>) {
    if (!draft) {
      return;
    }

    onDraftChange({
      ...draft,
      ...patch,
      updatedAt: Date.now(),
    });
  }

  return (
    <aside className="wm-editor-sidebar card">
      <div className="zone-editor-section">
        <h3>Editor</h3>
        <label>
          <span>Current Tool</span>
          <select value={selectedTool} onChange={(event) => onToolChange(event.target.value as ZoneEditorTool)}>
            {TOOL_OPTIONS.map((tool) => (
              <option key={tool.value} value={tool.value}>{tool.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Shape</span>
          <select
            value={draft?.shape ?? 'circle'}
            disabled={!draft}
            onChange={(event) => updateDraft({ shape: event.target.value as ZoneEditorDraft['shape'] })}
          >
            <option value="circle">circle</option>
            <option value="polygon">polygon</option>
            <option value="rect">rect</option>
          </select>
        </label>
        <div className="wm-meta-row">
          <span>Selected zone: {selectedZoneId ?? '-'}</span>
        </div>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showZones} onChange={(event) => onSettingsChange({ showZones: event.target.checked })} />
          <span>Show zones</span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showLabels} onChange={(event) => onSettingsChange({ showLabels: event.target.checked })} />
          <span>Show labels</span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showGrid} onChange={(event) => onSettingsChange({ showGrid: event.target.checked })} />
          <span>Show grid</span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.snapEnabled} onChange={(event) => onSettingsChange({ snapEnabled: event.target.checked })} />
          <span>Snap</span>
        </label>

        <h4>Region Painter</h4>
        <div className="wm-inline-buttons">
          {REGION_TOOL_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={regionToolMode === option.value ? 'is-active' : ''}
              onClick={() => onRegionToolModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label>
          <span>Region Type</span>
          <select value={regionType} onChange={(event) => onRegionTypeChange(event.target.value as RegionType)}>
            {REGION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Brush Size</span>
          <select value={String(regionBrushSize)} onChange={(event) => onRegionBrushSizeChange(Number(event.target.value) as RegionBrushSize)}>
            {BRUSH_SIZE_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>{option}</option>
            ))}
          </select>
        </label>

        <div className="zone-editor-color-row">
          <span>Region color preview</span>
          <div className="zone-editor-color-preview" style={{ background: REGION_TYPE_COLORS[regionType] }} />
        </div>
      </div>

      <div className="zone-editor-section">
        <h3>Zone Identity</h3>
        <label>
          <span>Id</span>
          <input disabled={!draft} value={draft?.id ?? ''} onChange={(event) => updateDraft({ id: event.target.value })} />
        </label>
        <label>
          <span>Name</span>
          <input disabled={!draft} value={draft?.name ?? ''} onChange={(event) => updateDraft({ name: event.target.value })} />
        </label>
        <label>
          <span>Type</span>
          <select disabled={!draft} value={draft?.type ?? 'city'} onChange={(event) => updateDraft({ type: event.target.value as ZoneType })}>
            {ZONE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Region</span>
          <input disabled={!draft} value={draft?.region ?? ''} onChange={(event) => updateDraft({ region: event.target.value })} />
        </label>
        <label>
          <span>Faction</span>
          <input disabled={!draft} value={draft?.faction ?? ''} onChange={(event) => updateDraft({ faction: event.target.value })} />
        </label>
        <div className="zone-editor-color-row">
          <span>Color preview</span>
          <div className="zone-editor-color-preview" style={{ background: ZONE_COLORS[draft?.type ?? 'city'] }} />
        </div>
      </div>

      <div className="zone-editor-section">
        <h3>Description</h3>
        <label>
          <span>Description</span>
          <textarea disabled={!draft} rows={4} value={draft?.description ?? ''} onChange={(event) => updateDraft({ description: event.target.value })} />
        </label>
        <label>
          <span>Tooltip</span>
          <textarea disabled={!draft} rows={3} value={draft?.tooltip ?? ''} onChange={(event) => updateDraft({ tooltip: event.target.value })} />
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Gameplay</h3>
        <label>
          <span>Danger Level</span>
          <input disabled={!draft} type="number" value={draft?.dangerLevel ?? 0} onChange={(event) => updateDraft({ dangerLevel: Number(event.target.value) || 0 })} />
        </label>
        <label>
          <span>Recommended Level</span>
          <input disabled={!draft} type="number" value={draft?.recommendedLevel ?? ''} onChange={(event) => updateDraft({ recommendedLevel: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Required Level</span>
          <input disabled={!draft} type="number" value={draft?.requiredLevel ?? ''} onChange={(event) => updateDraft({ requiredLevel: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Target Scene</span>
          <input disabled={!draft} value={draft?.targetScene ?? ''} onChange={(event) => updateDraft({ targetScene: event.target.value })} />
        </label>
        <label>
          <span>Required Quest Id</span>
          <input disabled={!draft} value={draft?.requiredQuestId ?? ''} onChange={(event) => updateDraft({ requiredQuestId: event.target.value })} />
        </label>
        <label>
          <span>Required Item Id</span>
          <input disabled={!draft} value={draft?.requiredItemId ?? ''} onChange={(event) => updateDraft({ requiredItemId: event.target.value })} />
        </label>
        <label>
          <span>Required Faction</span>
          <input disabled={!draft} value={draft?.requiredFaction ?? ''} onChange={(event) => updateDraft({ requiredFaction: event.target.value })} />
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.allowPvP ?? false} onChange={(event) => updateDraft({ allowPvP: event.target.checked })} />
          <span>allowPvP</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isSafeZone ?? false} onChange={(event) => updateDraft({ isSafeZone: event.target.checked })} />
          <span>isSafeZone</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isDiscovered ?? true} onChange={(event) => updateDraft({ isDiscovered: event.target.checked })} />
          <span>isDiscovered</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isVisibleToPlayer ?? true} onChange={(event) => updateDraft({ isVisibleToPlayer: event.target.checked })} />
          <span>isVisibleToPlayer</span>
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Spawn / Resources / Profession</h3>
        <label>
          <span>Enemy Table Id</span>
          <input disabled={!draft} value={draft?.enemyTableId ?? ''} onChange={(event) => updateDraft({ enemyTableId: event.target.value })} />
        </label>
        <label>
          <span>Resource Table Id</span>
          <input disabled={!draft} value={draft?.resourceTableId ?? ''} onChange={(event) => updateDraft({ resourceTableId: event.target.value })} />
        </label>
        <label>
          <span>Profession Id</span>
          <input disabled={!draft} value={draft?.professionId ?? ''} onChange={(event) => updateDraft({ professionId: event.target.value })} />
        </label>
        <label>
          <span>Respawn Seconds</span>
          <input disabled={!draft} type="number" value={draft?.respawnSeconds ?? ''} onChange={(event) => updateDraft({ respawnSeconds: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Cooldown Seconds</span>
          <input disabled={!draft} type="number" value={draft?.cooldownSeconds ?? ''} onChange={(event) => updateDraft({ cooldownSeconds: parseNumber(event.target.value) })} />
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Shape</h3>
        {draft?.shape === 'circle' ? (
          <>
            <div className="wm-meta-row">
              <span>X: {draft.x?.toFixed(4) ?? '-'}</span>
              <span>Y: {draft.y?.toFixed(4) ?? '-'}</span>
            </div>
            <label>
              <span>Radius</span>
              <div className="zone-editor-radius-row">
                <input
                  disabled={!draft}
                  type="range"
                  min={0.0025}
                  max={0.5}
                  step={0.001}
                  value={draft?.radius ?? 0.03}
                  onChange={(event) => updateDraft({ radius: Number(event.target.value) })}
                />
                <input
                  disabled={!draft}
                  type="number"
                  min={0.0025}
                  max={0.5}
                  step={0.001}
                  value={draft?.radius ?? ''}
                  onChange={(event) => updateDraft({ radius: parseNumber(event.target.value) })}
                />
              </div>
            </label>
          </>
        ) : (
          <>
            <div className="wm-meta-row">
              <span>Point count: {draft?.points.length ?? 0}</span>
              <span>Selected point: {draft?.selectedPointIndex ?? '-'}</span>
            </div>
            <div className="zone-editor-actions compact">
              <button disabled={!draft || draft.points.length === 0 || draft.selectedPointIndex === null} onClick={onDeleteSelectedPoint}>Delete Selected Point</button>
              <button disabled={!draft || draft.points.length < 3} onClick={onReversePoints}>Reverse Point Order</button>
            </div>
          </>
        )}
      </div>

      <div className="zone-editor-section">
        <h3>Actions</h3>
        <div className="zone-editor-actions">
          <button disabled={!hasDraft} onClick={onSaveNewZone}>Save New Zone</button>
          <button disabled={!hasDraft || !hasSelectedZone} onClick={onUpdateSelected}>Update Selected Zone</button>
          <button disabled={!hasSelectedZone} onClick={onDuplicateSelected}>Duplicate Selected</button>
          <button disabled={!hasSelectedZone} onClick={onDeleteSelected}>Delete Selected</button>
          <button disabled={!hasDraft} onClick={onClearDraft}>Clear Draft</button>
          <button onClick={onClearAll}>Clear All Zones</button>
          <button onClick={onResetStorage}>Reset Editor Storage</button>
        </div>
        <div className="wm-meta-row">
          <span>Saved zones: {zones.length}</span>
          <span>Draft: {draft ? `${draft.shape}` : '-'}</span>
        </div>
      </div>

      <details className="zone-editor-section zone-editor-collapsible">
        <summary>Import / Export JSON</summary>
        <div className="zone-editor-actions">
          <button onClick={onExport}>Export JSON</button>
          <button onClick={onCopyJson}>Copy JSON</button>
          <button onClick={onImportJson}>Import JSON</button>
          <button onClick={onValidateJson}>Validate JSON</button>
        </div>
        <div className="zone-json-area">
          <textarea value={jsonValue} rows={12} onChange={(event) => onJsonChange(event.target.value)} />
        </div>
      </details>

      <details className="zone-editor-section zone-editor-collapsible">
        <summary>Debug</summary>
        <div className="wm-meta-row">
          <span>Validation messages: {validationErrors.length}</span>
          <span>Saved zones: {zones.length}</span>
        </div>
        {validationErrors.length > 0 ? (
          <div className="zone-validation-errors">
            {validationErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : (
          <div className="muted">No validation errors.</div>
        )}
      </details>
    </aside>
  );
}
