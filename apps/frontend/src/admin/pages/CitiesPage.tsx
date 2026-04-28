import { useEffect, useMemo, useRef, useState } from 'react';
import type { City, CityLocation, CityLocationShapeType, CityLocationType, CityStatus } from '../../types/city';
import { cityService } from '../../services/cityRepository';

const STATUS_OPTIONS: CityStatus[] = ['active', 'ruined', 'occupied', 'hidden', 'locked'];
const LOCATION_TYPES: CityLocationType[] = [
  'gate', 'tavern', 'market', 'blacksmith', 'castle', 'temple', 'arena', 'guild',
  'district', 'harbor', 'barracks', 'house', 'dungeon', 'custom',
];

function nowIso(): string {
  return new Date().toISOString();
}

function splitCsv(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function joinCsv(value: string[] | undefined): string {
  return (value ?? []).join(', ');
}

function createNewCity(): City {
  const createdAt = nowIso();
  return {
    id: `city_${Date.now()}`,
    name: 'Новый город',
    kingdomId: '',
    status: 'active',
    shortDescription: '',
    fullDescription: '',
    racePopulation: [],
    economyTags: [],
    cultureTags: [],
    locations: [],
    connectedCityIds: [],
    connectedZoneIds: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function createNewLocation(cityId: string): CityLocation {
  return {
    id: `location_${Date.now()}`,
    cityId,
    name: 'Новая локация',
    type: 'custom',
    description: '',
    shapeType: 'rectangle',
    shape: { x: 80, y: 80, width: 160, height: 90 },
    npcIds: [],
    questIds: [],
    shopIds: [],
    isVisible: true,
    isUnlocked: true,
    markerIcon: '',
  };
}

export function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [draft, setDraft] = useState<City | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'main' | 'lore' | 'population' | 'rule' | 'gameplay' | 'locations' | 'images'>('main');
  const [tool, setTool] = useState<'select' | 'circle' | 'rectangle' | 'polygon' | 'delete'>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [status, setStatus] = useState('');

  const canvasRef = useRef<HTMLDivElement | null>(null);

  async function reload(selectId?: string) {
    const next = await cityService.getCities();
    setCities(next);
    const id = selectId ?? selectedCityId ?? next[0]?.id ?? '';
    setSelectedCityId(id);
    setDraft(next.find((city) => city.id === id) ?? next[0] ?? null);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((city) =>
      city.id.toLowerCase().includes(q)
      || city.name.toLowerCase().includes(q)
      || city.kingdomId.toLowerCase().includes(q),
    );
  }, [cities, query]);

  const selectedLocation = useMemo(
    () => draft?.locations.find((location) => location.id === selectedLocationId) ?? draft?.locations[0] ?? null,
    [draft, selectedLocationId],
  );

  function selectCity(id: string) {
    const city = cities.find((entry) => entry.id === id) ?? null;
    setSelectedCityId(id);
    setDraft(city ? structuredClone(city) : null);
    setSelectedLocationId(city?.locations[0]?.id ?? '');
  }

  function patchCity(patch: Partial<City>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function patchSelectedLocation(patch: Partial<CityLocation>) {
    setDraft((current) => {
      if (!current || !selectedLocation) return current;
      return {
        ...current,
        locations: current.locations.map((location) =>
          location.id === selectedLocation.id ? { ...location, ...patch } : location,
        ),
      };
    });
  }

  function validateCity(city: City): string[] {
    const warnings: string[] = [];
    if (!city.id.trim()) warnings.push('City ID is required.');
    if (!city.name.trim()) warnings.push('City name is required.');
    if (!city.kingdomId.trim()) warnings.push('Kingdom is required.');

    const locationIds = new Set<string>();
    for (const location of city.locations) {
      if (!location.id.trim()) warnings.push('Location ID is required.');
      if (locationIds.has(location.id)) warnings.push(`Duplicate location id: ${location.id}`);
      locationIds.add(location.id);
      if (!location.shapeType || !location.shape) warnings.push(`Location shape required: ${location.id}`);
    }

    return warnings;
  }

  async function saveCity() {
    if (!draft) return;

    const warnings = validateCity(draft);
    if (warnings.length > 0) {
      setStatus(warnings.join(' '));
      return;
    }

    const exists = cities.some((city) => city.id === draft.id);
    if (exists) {
      await cityService.updateCity(draft);
    } else {
      await cityService.createCity(draft);
    }

    setStatus('Сохранено.');
    await reload(draft.id);
  }

  async function addCity() {
    const next = createNewCity();
    setSelectedCityId(next.id);
    setDraft(next);
    setSelectedLocationId('');
    setStatus('Создан черновик города. Нажмите SAVE.');
  }

  async function duplicateCity() {
    if (!draft) return;
    const copy = await cityService.duplicateCity(draft.id);
    await reload(copy.id);
    setStatus('Город дублирован.');
  }

  async function deleteCity() {
    if (!draft) return;
    if (!window.confirm(`Удалить город ${draft.name}?`)) return;
    await cityService.deleteCity(draft.id);
    const next = cities.filter((city) => city.id !== draft.id);
    await reload(next[0]?.id);
  }

  function addLocation() {
    if (!draft) return;
    const location = createNewLocation(draft.id);
    patchCity({ locations: [...draft.locations, location] });
    setSelectedLocationId(location.id);
    setTab('locations');
  }

  function deleteLocation() {
    if (!draft || !selectedLocation) return;
    patchCity({ locations: draft.locations.filter((location) => location.id !== selectedLocation.id) });
    setSelectedLocationId('');
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.altKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((current) => Math.max(0.25, Math.min(4, Number((current + delta).toFixed(2)))));
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button === 1) {
      event.preventDefault();
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (!draft || tool === 'select') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.round((event.clientX - rect.left - pan.x) / zoom);
    const y = Math.round((event.clientY - rect.top - pan.y) / zoom);

    if (tool === 'rectangle' || tool === 'circle') {
      const location = createNewLocation(draft.id);
      location.shapeType = tool;
      location.shape = tool === 'circle'
        ? { x, y, radius: 50 }
        : { x, y, width: 140, height: 90 };
      patchCity({ locations: [...draft.locations, location] });
      setSelectedLocationId(location.id);
      setTab('locations');
    }
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning) return;
    setPan({
      x: panStart.panX + event.clientX - panStart.x,
      y: panStart.panY + event.clientY - panStart.y,
    });
  }

  function stopPanning() {
    setIsPanning(false);
  }

  const backgroundStyle = draft?.backgroundImageId
    ? { backgroundImage: `url("${draft.backgroundImageId.startsWith('img_') ? '' : draft.backgroundImageId}")` }
    : {};

  return (
    <div className="city-editor admin-editor-page">
      <div className="city-editor-toolbar">
        <button type="button" onClick={addCity}>NEW CITY</button>
        <button type="button" onClick={duplicateCity} disabled={!draft}>DUPLICATE</button>
        <button type="button" onClick={deleteCity} disabled={!draft}>DELETE</button>
        <button type="button" onClick={saveCity} disabled={!draft}>SAVE</button>
        <span>{status}</span>
      </div>

      <div className="city-editor-layout">
        <aside className="city-list-panel card">
          <h3>Cities</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name/id/kingdom" />
          <div className="city-list-scroll">
            {filteredCities.map((city) => (
              <button
                key={city.id}
                type="button"
                className={city.id === selectedCityId ? 'is-active' : ''}
                onClick={() => selectCity(city.id)}
              >
                <strong>{city.name}</strong>
                <span>{city.id}</span>
                <small>{city.kingdomId}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="city-canvas-panel card">
          <div className="city-canvas-toolbar">
            <button type="button" className={tool === 'select' ? 'is-active' : ''} onClick={() => setTool('select')}>SELECT</button>
            <button type="button" className={tool === 'rectangle' ? 'is-active' : ''} onClick={() => setTool('rectangle')}>RECT</button>
            <button type="button" className={tool === 'circle' ? 'is-active' : ''} onClick={() => setTool('circle')}>CIRCLE</button>
            <button type="button" onClick={addLocation}>+ LOCATION</button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>FIT</button>
            <span>Alt + wheel = zoom, middle mouse drag = pan</span>
          </div>

          <div
            ref={canvasRef}
            className="city-canvas-viewport"
            onWheel={handleCanvasWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={stopPanning}
            onPointerCancel={stopPanning}
          >
            <div
              className="city-canvas-stage"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                ...backgroundStyle,
              }}
            >
              {!draft?.backgroundImageId ? <div className="city-canvas-empty">No city background image selected</div> : null}

              {draft?.locations.map((location) => {
                const selected = location.id === selectedLocation?.id;
                const shape = location.shape;
                const common: React.CSSProperties = {
                  left: `${shape.x ?? 0}px`,
                  top: `${shape.y ?? 0}px`,
                };

                if (location.shapeType === 'circle') {
                  const r = shape.radius ?? 40;
                  return (
                    <button
                      key={location.id}
                      type="button"
                      className={`city-location-shape city-location-circle ${selected ? 'is-selected' : ''}`}
                      style={{ ...common, width: `${r * 2}px`, height: `${r * 2}px` }}
                      onClick={() => { setSelectedLocationId(location.id); setTab('locations'); }}
                    >
                      {location.name}
                    </button>
                  );
                }

                return (
                  <button
                    key={location.id}
                    type="button"
                    className={`city-location-shape city-location-rect ${selected ? 'is-selected' : ''}`}
                    style={{ ...common, width: `${shape.width ?? 120}px`, height: `${shape.height ?? 80}px` }}
                    onClick={() => { setSelectedLocationId(location.id); setTab('locations'); }}
                  >
                    {location.name}
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="city-detail-panel card">
          {!draft ? (
            <p>No city selected.</p>
          ) : (
            <>
              <div className="city-tabs">
                {(['main', 'lore', 'population', 'rule', 'gameplay', 'locations', 'images'] as const).map((entry) => (
                  <button key={entry} type="button" className={tab === entry ? 'is-active' : ''} onClick={() => setTab(entry)}>
                    {entry}
                  </button>
                ))}
              </div>

              <div className="city-detail-scroll">
                {tab === 'main' && (
                  <div className="city-form-grid">
                    <label>ID<input value={draft.id} onChange={(e) => patchCity({ id: e.target.value })} /></label>
                    <label>Name<input value={draft.name} onChange={(e) => patchCity({ name: e.target.value })} /></label>
                    <label>Kingdom<input value={draft.kingdomId} onChange={(e) => patchCity({ kingdomId: e.target.value })} /></label>
                    <label>Region<input value={draft.regionId ?? ''} onChange={(e) => patchCity({ regionId: e.target.value })} /></label>
                    <label>World Zone ID<input value={draft.worldZoneId ?? ''} onChange={(e) => patchCity({ worldZoneId: e.target.value })} /></label>
                    <label>Status
                      <select value={draft.status} onChange={(e) => patchCity({ status: e.target.value as CityStatus })}>
                        {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label>Owner Faction<input value={draft.ownerFactionId ?? ''} onChange={(e) => patchCity({ ownerFactionId: e.target.value })} /></label>
                    <label>Recommended Level<input type="number" value={draft.recommendedLevel ?? 1} onChange={(e) => patchCity({ recommendedLevel: Number(e.target.value) })} /></label>
                    <label>Danger Level<input type="number" value={draft.dangerLevel ?? 0} onChange={(e) => patchCity({ dangerLevel: Number(e.target.value) })} /></label>
                  </div>
                )}

                {tab === 'lore' && (
                  <div className="city-form-grid">
                    <label>Short Description<textarea value={draft.shortDescription} onChange={(e) => patchCity({ shortDescription: e.target.value })} /></label>
                    <label>Full Description<textarea value={draft.fullDescription} onChange={(e) => patchCity({ fullDescription: e.target.value })} /></label>
                    <label>History<textarea value={draft.history ?? ''} onChange={(e) => patchCity({ history: e.target.value })} /></label>
                    <label>Lore Notes<textarea value={draft.loreNotes ?? ''} onChange={(e) => patchCity({ loreNotes: e.target.value })} /></label>
                    <label>Climate<input value={draft.climate ?? ''} onChange={(e) => patchCity({ climate: e.target.value })} /></label>
                    <label>Visual Theme<input value={draft.visualTheme ?? ''} onChange={(e) => patchCity({ visualTheme: e.target.value })} /></label>
                    <label>Culture Tags<input value={joinCsv(draft.cultureTags)} onChange={(e) => patchCity({ cultureTags: splitCsv(e.target.value) })} /></label>
                  </div>
                )}

                {tab === 'population' && (
                  <div className="city-form-grid">
                    <label>Total Population<input type="number" value={draft.populationTotal ?? 0} onChange={(e) => patchCity({ populationTotal: Number(e.target.value) })} /></label>
                    <button type="button" onClick={() => patchCity({ racePopulation: [...draft.racePopulation, { raceId: 'human', percent: 100, role: '' }] })}>+ Race Row</button>
                    {draft.racePopulation.map((row, index) => (
                      <div key={`${row.raceId}-${index}`} className="city-race-row">
                        <input value={row.raceId} onChange={(e) => {
                          const rows = [...draft.racePopulation];
                          rows[index] = { ...rows[index], raceId: e.target.value };
                          patchCity({ racePopulation: rows });
                        }} />
                        <input type="number" value={row.count ?? 0} onChange={(e) => {
                          const rows = [...draft.racePopulation];
                          rows[index] = { ...rows[index], count: Number(e.target.value) };
                          patchCity({ racePopulation: rows });
                        }} />
                        <input type="number" value={row.percent ?? 0} onChange={(e) => {
                          const rows = [...draft.racePopulation];
                          rows[index] = { ...rows[index], percent: Number(e.target.value) };
                          patchCity({ racePopulation: rows });
                        }} />
                        <input value={row.role ?? ''} onChange={(e) => {
                          const rows = [...draft.racePopulation];
                          rows[index] = { ...rows[index], role: e.target.value };
                          patchCity({ racePopulation: rows });
                        }} />
                        <button type="button" onClick={() => patchCity({ racePopulation: draft.racePopulation.filter((_, i) => i !== index) })}>DELETE</button>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'rule' && (
                  <div className="city-form-grid">
                    <label>Ruler NPC ID<input value={draft.rulerNpcId ?? ''} onChange={(e) => patchCity({ rulerNpcId: e.target.value })} /></label>
                    <label>Ruler Name<input value={draft.rulerName ?? ''} onChange={(e) => patchCity({ rulerName: e.target.value })} /></label>
                    <label>Ruler Title<input value={draft.rulerTitle ?? ''} onChange={(e) => patchCity({ rulerTitle: e.target.value })} /></label>
                    <label>Government Type<input value={draft.governmentType ?? ''} onChange={(e) => patchCity({ governmentType: e.target.value })} /></label>
                    <label><input type="checkbox" checked={Boolean(draft.hostileToPlayer)} onChange={(e) => patchCity({ hostileToPlayer: e.target.checked })} /> Hostile to player</label>
                    <label>Entry Requirement<input value={draft.entryRequirement ?? ''} onChange={(e) => patchCity({ entryRequirement: e.target.value })} /></label>
                  </div>
                )}

                {tab === 'gameplay' && (
                  <div className="city-form-grid">
                    <label>Economy Tags<input value={joinCsv(draft.economyTags)} onChange={(e) => patchCity({ economyTags: splitCsv(e.target.value) })} /></label>
                    <label>Connected Cities<input value={joinCsv(draft.connectedCityIds)} onChange={(e) => patchCity({ connectedCityIds: splitCsv(e.target.value) })} /></label>
                    <label>Connected Zones<input value={joinCsv(draft.connectedZoneIds)} onChange={(e) => patchCity({ connectedZoneIds: splitCsv(e.target.value) })} /></label>
                  </div>
                )}

                {tab === 'locations' && (
                  <div className="city-form-grid">
                    <button type="button" onClick={addLocation}>+ Location</button>
                    <div className="city-location-list">
                      {draft.locations.map((location) => (
                        <button key={location.id} type="button" className={selectedLocationId === location.id ? 'is-active' : ''} onClick={() => setSelectedLocationId(location.id)}>
                          {location.name} / {location.id}
                        </button>
                      ))}
                    </div>

                    {selectedLocation && (
                      <>
                        <button type="button" onClick={deleteLocation}>DELETE LOCATION</button>
                        <label>Location ID<input value={selectedLocation.id} onChange={(e) => patchSelectedLocation({ id: e.target.value })} /></label>
                        <label>Name<input value={selectedLocation.name} onChange={(e) => patchSelectedLocation({ name: e.target.value })} /></label>
                        <label>Type
                          <select value={selectedLocation.type} onChange={(e) => patchSelectedLocation({ type: e.target.value as CityLocationType })}>
                            {LOCATION_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                          </select>
                        </label>
                        <label>Description<textarea value={selectedLocation.description ?? ''} onChange={(e) => patchSelectedLocation({ description: e.target.value })} /></label>
                        <label>Shape Type
                          <select value={selectedLocation.shapeType} onChange={(e) => patchSelectedLocation({ shapeType: e.target.value as CityLocationShapeType })}>
                            <option value="rectangle">rectangle</option>
                            <option value="circle">circle</option>
                            <option value="polygon">polygon</option>
                          </select>
                        </label>
                        <label>NPC IDs<input value={joinCsv(selectedLocation.npcIds)} onChange={(e) => patchSelectedLocation({ npcIds: splitCsv(e.target.value) })} /></label>
                        <label>Quest IDs<input value={joinCsv(selectedLocation.questIds)} onChange={(e) => patchSelectedLocation({ questIds: splitCsv(e.target.value) })} /></label>
                        <label>Shop IDs<input value={joinCsv(selectedLocation.shopIds)} onChange={(e) => patchSelectedLocation({ shopIds: splitCsv(e.target.value) })} /></label>
                        <label><input type="checkbox" checked={selectedLocation.isVisible} onChange={(e) => patchSelectedLocation({ isVisible: e.target.checked })} /> Visible</label>
                        <label><input type="checkbox" checked={selectedLocation.isUnlocked} onChange={(e) => patchSelectedLocation({ isUnlocked: e.target.checked })} /> Unlocked</label>
                        <label>Unlock Condition<input value={selectedLocation.unlockCondition ?? ''} onChange={(e) => patchSelectedLocation({ unlockCondition: e.target.value })} /></label>
                        <label>Marker Icon<input value={selectedLocation.markerIcon ?? ''} onChange={(e) => patchSelectedLocation({ markerIcon: e.target.value })} /></label>
                      </>
                    )}
                  </div>
                )}

                {tab === 'images' && (
                  <div className="city-form-grid">
                    <label>Background Image ID / URL<input value={draft.backgroundImageId ?? ''} onChange={(e) => patchCity({ backgroundImageId: e.target.value })} /></label>
                    <label>Thumbnail Image ID / URL<input value={draft.thumbnailImageId ?? ''} onChange={(e) => patchCity({ thumbnailImageId: e.target.value })} /></label>
                    <p className="muted">For now paste image URL or existing image id. Later hook image picker from ImagesPage.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

