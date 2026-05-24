import { useEffect, useState } from 'react';
import type {
  ActiveWorldEntity,
  WorldNpcArchetype,
  WorldRoute,
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

const WORLD_SNAPSHOT_POLL_INTERVAL_MS = 250;

const worldSnapshotStore: {
  state: WorldSnapshotStoreState;
  listeners: Set<(state: WorldSnapshotStoreState) => void>;
  intervalId: ReturnType<typeof setInterval> | null;
  inFlight: Promise<void> | null;
} = {
  state: {
    snapshot: null,
    loading: true,
    error: null,
  },
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
  if (worldSnapshotStore.inFlight) {
    return worldSnapshotStore.inFlight;
  }

  const request = (async () => {
    try {
      const response = await fetch('/api/world-simulation/snapshot');
      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot: ${response.statusText}`);
      }

      const data = await response.json();
      worldSnapshotStore.state = {
        snapshot: data,
        loading: false,
        error: null,
      };
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
  if (worldSnapshotStore.intervalId) {
    return;
  }

  void refreshWorldSnapshotStore();
  worldSnapshotStore.intervalId = setInterval(() => {
    void refreshWorldSnapshotStore();
  }, WORLD_SNAPSHOT_POLL_INTERVAL_MS);
}

function stopWorldSnapshotPolling() {
  if (!worldSnapshotStore.intervalId) {
    return;
  }

  clearInterval(worldSnapshotStore.intervalId);
  worldSnapshotStore.intervalId = null;
}

/**
 * Хук для получения снимка мира (активные сущности, цены, события).
 */
export function useWorldSnapshot() {
  const [state, setState] = useState<WorldSnapshotStoreState>(worldSnapshotStore.state);

  useEffect(() => {
    const listener = (nextState: WorldSnapshotStoreState) => {
      setState(nextState);
    };

    worldSnapshotStore.listeners.add(listener);
    setState(worldSnapshotStore.state);
    startWorldSnapshotPolling();

    return () => {
      worldSnapshotStore.listeners.delete(listener);
      if (worldSnapshotStore.listeners.size === 0) {
        stopWorldSnapshotPolling();
      }
    };
  }, []);

  return state;
}

/**
 * Хук для получения зон world map (нужно для удобных селектов в админке).
 */
export function useWorldMapZones() {
  const [zones, setZones] = useState<WorldMapZoneOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/content/world-map')
      .then((r) => r.json())
      .then((data) => {
        setZones(Array.isArray(data?.zones) ? data.zones : []);
        setLoading(false);
      })
      .catch(() => {
        setZones([]);
        setLoading(false);
      });
  }, []);

  return { zones, loading };
}

/**
 * Хук для управления архетипами.
 */
export function useWorldArchetypes() {
  const [archetypes, setArchetypes] = useState<WorldNpcArchetype[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/archetypes')
      .then((r) => r.json())
      .then((data) => {
        setArchetypes(data);
        setLoading(false);
      });
  }, []);

  const create = async (archetype: WorldNpcArchetype) => {
    const res = await fetch('/api/world-simulation/archetypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(archetype),
    });
    const data = await res.json();
    setArchetypes([...archetypes, data as WorldNpcArchetype]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldNpcArchetype>) => {
    const res = await fetch(`/api/world-simulation/archetypes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setArchetypes(archetypes.map((a) => (a.id === id ? data as WorldNpcArchetype : a)));
    return data;
  };

  return { archetypes, loading, create, update };
}

/**
 * Хук для управления маршрутами.
 */
export function useWorldRoutes() {
  const [routes, setRoutes] = useState<WorldRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/routes')
      .then((r) => r.json())
      .then((data) => {
        setRoutes(data);
        setLoading(false);
      });
  }, []);

  const create = async (route: WorldRoute) => {
    const res = await fetch('/api/world-simulation/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    const data = await res.json();
    setRoutes([...routes, data as WorldRoute]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldRoute>) => {
    const res = await fetch(`/api/world-simulation/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setRoutes(routes.map((r) => (r.id === id ? data as WorldRoute : r)));
    return data;
  };

  return { routes, loading, create, update };
}

/**
 * Хук для управления правилами спавна.
 */
export function useWorldSpawnRules() {
  const [rules, setRules] = useState<WorldSpawnRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/world-simulation/spawn-rules')
      .then((r) => r.json())
      .then((data) => {
        setRules(data);
        setLoading(false);
      });
  }, []);

  const create = async (rule: WorldSpawnRule) => {
    const res = await fetch('/api/world-simulation/spawn-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    const data = await res.json();
    setRules([...rules, data as WorldSpawnRule]);
    return data;
  };

  const update = async (id: string, updates: Partial<WorldSpawnRule>) => {
    const res = await fetch(`/api/world-simulation/spawn-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setRules(rules.map((r) => (r.id === id ? data as WorldSpawnRule : r)));
    return data;
  };

  return { rules, loading, create, update };
}

/**
 * Хук для управления активными сущностями (GM commands).
 */
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
    refresh();

    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  const killEntity = async (id: string) => {
    await fetch(`/api/world-simulation/active-entities/${id}/kill`, {
      method: 'POST',
    });
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
