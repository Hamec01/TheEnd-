import { useEffect, useState } from 'react';
import type {
  ActiveWorldEntity,
  WorldNpcArchetype,
  WorldRoute,
  WorldSimConfig,
  WorldSimImportResult,
  WorldSimulationSnapshot,
  WorldSpawnRule,
} from '../types/world-simulation.types';

interface WorldMapZoneOption {
  id: string;
  name?: string;
  cityId?: string;
  type?: string;
}

interface WorldSnapshotStoreState {
  snapshot: WorldSimulationSnapshot | null;
  loading: boolean;
  error: string | null;
}

async function parseJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── World Snapshot polling store (shared across hooks) ────────────────────

const WORLD_SNAPSHOT_POLL_INTERVAL_MS = 250;

const worldSnapshotStore: {
  state: WorldSnapshotStoreState;
  listeners: Set<(state: WorldSnapshotStoreState) => void>;
  intervalId: ReturnType<typeof setInterval> | null;
  inFlight: Promise<void> | null;
} = {
  state: { snapshot: null, loading: true, error: null },
  listeners: new Set(),
  intervalId: null,
  inFlight: null,
};

function emitWorldSnapshotStore() {
  for (const listener of worldSnapshotStore.listeners) {
    listener(worldSnapshotStore.state);
  }
}

async function refreshWorldSnapshotStore() {
  if (worldSnapshotStore.inFlight) return worldSnapshotStore.inFlight;

  const request = (async () => {
    try {
      const response = await fetch('/api/world-simulation/snapshot');
      if (!response.ok) throw new Error(`Failed to fetch snapshot: ${response.statusText}`);
      const data = await response.json();
      worldSnapshotStore.state = { snapshot: data, loading: false, error: null };
    } catch (err) {
      worldSnapshotStore.state = {
        ...worldSnapshotStore.state,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      worldSnapshotStore.inFlight = null;
      emitWorldSnapshotStore();
    }
  })();

  worldSnapshotStore.inFlight = request;
  return request;
}

function startWorldSnapshotPolling() {
  if (worldSnapshotStore.intervalId) return;
  void refreshWorldSnapshotStore();
  worldSnapshotStore.intervalId = setInterval(() => void refreshWorldSnapshotStore(), WORLD_SNAPSHOT_POLL_INTERVAL_MS);
}

function stopWorldSnapshotPolling() {
  if (!worldSnapshotStore.intervalId) return;
  clearInterval(worldSnapshotStore.intervalId);
  worldSnapshotStore.intervalId = null;
}

// ─── Config API helpers ────────────────────────────────────────────────────

/** Fetch the current persistent World-Sim config from the backend. */
export async function fetchWorldSimConfig(): Promise<WorldSimConfig> {
  const res = await fetch('/api/world-simulation/config');
  if (!res.ok) throw new Error(`fetchWorldSimConfig failed: ${res.statusText}`);
  return res.json();
}

/** Replace the persistent World-Sim config on the backend. */
export async function saveWorldSimConfig(config: WorldSimConfig): Promise<WorldSimImportResult> {
  const res = await fetch('/api/world-simulation/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data?.message ?? data?.errors?.[0]) ?? 'saveWorldSimConfig failed');
  return data as WorldSimImportResult;
}

/** Import (replace or merge) a World-Sim config on the backend. */
export async function importWorldSimConfig(
  mode: 'replace' | 'merge',
  config: WorldSimConfig,
): Promise<WorldSimImportResult> {
  const res = await fetch('/api/world-simulation/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, config }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data?.message ?? data?.errors?.[0]) ?? 'importWorldSimConfig failed');
  return data as WorldSimImportResult;
}

/** Validate a config against the backend without saving. */
export async function validateWorldSimConfig(config: WorldSimConfig): Promise<{ ok: boolean; errors: string[] }> {
  const res = await fetch('/api/world-simulation/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

/** Trigger browser download of a World-Sim JSON file. */
export function downloadWorldSimJson(config: WorldSimConfig): void {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theend_world_sim_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── useWorldSnapshot ─────────────────────────────────────────────────────

export function useWorldSnapshot() {
  const [state, setState] = useState<WorldSnapshotStoreState>(worldSnapshotStore.state);

  useEffect(() => {
    const listener = (nextState: WorldSnapshotStoreState) => setState(nextState);
    worldSnapshotStore.listeners.add(listener);
    setState(worldSnapshotStore.state);
    startWorldSnapshotPolling();
    return () => {
      worldSnapshotStore.listeners.delete(listener);
      if (worldSnapshotStore.listeners.size === 0) stopWorldSnapshotPolling();
    };
  }, []);

  return state;
}

// ─── useWorldMapZones ─────────────────────────────────────────────────────

export function useWorldMapZones() {
  const [zones, setZones] = useState<WorldMapZoneOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/content/world-map')
      .then((r) => r.json())
      .then((data) => { setZones(Array.isArray(data?.zones) ? data.zones : []); setLoading(false); })
      .catch(() => { setZones([]); setLoading(false); });
  }, []);

  return { zones, loading };
}

// ─── useWorldArchetypes ───────────────────────────────────────────────────

export function useWorldArchetypes() {
  const [archetypes, setArchetypes] = useState<WorldNpcArchetype[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/archetypes')
      .then((r) => parseJsonSafe(r))
      .then((data) => { setArchetypes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setArchetypes([]); setLoading(false); });
  }, []);

  const create = async (archetype: WorldNpcArchetype) => {
    const res = await fetch('/api/world-simulation/archetypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(archetype),
    });
    const data = await res.json();
    setArchetypes((current) => [...current, data as WorldNpcArchetype]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldNpcArchetype>) => {
    const res = await fetch(`/api/world-simulation/archetypes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setArchetypes((current) => current.map((a) => (a.id === id ? (data as WorldNpcArchetype) : a)));
    return data;
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/world-simulation/archetypes/${id}`, { method: 'DELETE' });
    const data = await parseJsonSafe(res);
    setArchetypes((current) => current.filter((a) => a.id !== id));
    return (data ?? { success: res.ok, removedActiveEntities: 0, updatedRoutes: 0, updatedSpawnRules: 0 }) as {
      success: boolean;
      removedActiveEntities: number;
      updatedRoutes: number;
      updatedSpawnRules: number;
    };
  };

  /** Replace local archetypes list (e.g. after import). */
  const reload = (next: WorldNpcArchetype[]) => setArchetypes(next);

  return { archetypes, loading, create, update, remove, reload };
}

// ─── useWorldRoutes ───────────────────────────────────────────────────────

export function useWorldRoutes() {
  const [routes, setRoutes] = useState<WorldRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/routes')
      .then((r) => parseJsonSafe(r))
      .then((data) => { setRoutes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setRoutes([]); setLoading(false); });
  }, []);

  const create = async (route: WorldRoute) => {
    const res = await fetch('/api/world-simulation/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    const data = await res.json();
    setRoutes((current) => [...current, data as WorldRoute]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldRoute>) => {
    const res = await fetch(`/api/world-simulation/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setRoutes((current) => current.map((r) => (r.id === id ? (data as WorldRoute) : r)));
    return data;
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/world-simulation/routes/${id}`, { method: 'DELETE' });
    const data = await parseJsonSafe(res);
    setRoutes((current) => current.filter((r) => r.id !== id));
    return (data ?? { success: res.ok, removedActiveEntities: 0 }) as {
      success: boolean;
      removedActiveEntities: number;
    };
  };

  const reload = (next: WorldRoute[]) => setRoutes(next);

  return { routes, loading, create, update, remove, reload };
}

// ─── useWorldSpawnRules ───────────────────────────────────────────────────

export function useWorldSpawnRules() {
  const [rules, setRules] = useState<WorldSpawnRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/spawn-rules')
      .then((r) => parseJsonSafe(r))
      .then((data) => { setRules(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setRules([]); setLoading(false); });
  }, []);

  const create = async (rule: WorldSpawnRule) => {
    const res = await fetch('/api/world-simulation/spawn-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    const data = await res.json();
    setRules((current) => [...current, data as WorldSpawnRule]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldSpawnRule>) => {
    const res = await fetch(`/api/world-simulation/spawn-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setRules((current) => current.map((r) => (r.id === id ? (data as WorldSpawnRule) : r)));
    return data;
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/world-simulation/spawn-rules/${id}`, { method: 'DELETE' });
    const data = await parseJsonSafe(res);
    setRules((current) => current.filter((r) => r.id !== id));
    return (data ?? { success: res.ok }) as { success: boolean };
  };

  const reload = (next: WorldSpawnRule[]) => setRules(next);

  return { rules, loading, create, update, remove, reload };
}

// ─── useActiveWorldEntities ───────────────────────────────────────────────

export function useActiveWorldEntities() {
  const [entities, setEntities] = useState<ActiveWorldEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const res = await fetch('/api/world-simulation/active-entities');
    const data = await res.json();
    setEntities(data);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 1000);
    return () => clearInterval(interval);
  }, []);

  const killEntity = async (id: string) => {
    await fetch(`/api/world-simulation/active-entities/${id}/kill`, { method: 'POST' });
    await refresh();
  };

  const freezeEntity = async (id: string, durationHours: number) => {
    await fetch(`/api/world-simulation/active-entities/${id}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationHours }),
    });
    await refresh();
  };

  const teleportEntity = async (id: string, zoneId: string, coordinates: { x: number; y: number }) => {
    await fetch(`/api/world-simulation/active-entities/${id}/teleport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId, coordinates }),
    });
    await refresh();
  };

  return { entities, loading, killEntity, freezeEntity, teleportEntity, refresh };
}
