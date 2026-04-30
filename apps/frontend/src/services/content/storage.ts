const PREFIX = 'theend.content.';

interface DbShape {
  items: unknown[];
  skills: unknown[];
  merchants: unknown[];
  materials: unknown[];
  lootTables: unknown[];
  images: unknown[];
}

const DEFAULT_DB: DbShape = {
  items: [],
  skills: [],
  merchants: [],
  materials: [],
  lootTables: [],
  images: [],
};

function key(name: keyof DbShape): string {
  return `${PREFIX}${name}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readCollection<T>(name: keyof DbShape): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<T[]>(window.localStorage.getItem(key(name)), []);
}

export function writeCollection<T>(name: keyof DbShape, values: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key(name), JSON.stringify(values));
}

export function resetContentStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  (Object.keys(DEFAULT_DB) as Array<keyof DbShape>).forEach((name) => {
    window.localStorage.removeItem(key(name));
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}
