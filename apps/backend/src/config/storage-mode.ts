export type ContentStorageMode = 'file' | 'postgres';

function normalized(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function getConfiguredStorageMode(): string {
  return normalized(process.env.CONTENT_STORAGE_MODE ?? process.env.CONTENT_STORAGE);
}

export function getContentStorageMode(): ContentStorageMode {
  const configured = getConfiguredStorageMode();
  if (configured === 'file' || configured === 'json') {
    return 'file';
  }
  if (configured === 'postgres' || configured === 'database') {
    return 'postgres';
  }

  if (normalized(process.env.APP_ENV) === 'production' || normalized(process.env.NODE_ENV) === 'production') {
    return 'postgres';
  }

  return normalized(process.env.DATABASE_URL) ? 'postgres' : 'file';
}

export function isFileStorageMode(): boolean {
  return getContentStorageMode() === 'file';
}

export function isDatabaseEnabled(): boolean {
  return getContentStorageMode() === 'postgres';
}

export function getDatabaseStatus(): 'disabled' | 'online' {
  return isDatabaseEnabled() ? 'online' : 'disabled';
}

export function assertDatabaseConfiguration(): void {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (!normalized(process.env.DATABASE_URL)) {
    throw new Error('DATABASE_URL is required when CONTENT_STORAGE_MODE=postgres or APP_ENV=production.');
  }
}
