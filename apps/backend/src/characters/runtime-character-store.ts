import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { randomUUID } from 'crypto';

export interface RuntimeAccountRecord {
  id: string;
  login?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RuntimeCharacterRecord {
  id: string;
  accountId: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}

interface RuntimeDataFile {
  schemaVersion: number;
  runtime: {
    accounts: RuntimeAccountRecord[];
    characters: RuntimeCharacterRecord[];
    arenaData?: Record<string, unknown>;
  };
}

const RUNTIME_SCHEMA_VERSION = 1;
const DEFAULT_RUNTIME_FILE_NAME = 'theend_runtime.local.json';

function resolveDataDir(): string {
  const configured = String(process.env.RUNTIME_DATA_DIR ?? process.env.CONTENT_DATA_DIR ?? '').trim();
  if (!configured) {
    return join(process.cwd(), 'data');
  }

  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function resolveRuntimeFilePath(): { runtimeFileName: string; runtimeFilePath: string } {
  const configuredPath = String(process.env.RUNTIME_DATA_FILE ?? process.env.RUNTIME_FILE_NAME ?? '').trim();
  if (!configuredPath) {
    const runtimeFileName = DEFAULT_RUNTIME_FILE_NAME;
    return {
      runtimeFileName,
      runtimeFilePath: join(resolveDataDir(), runtimeFileName),
    };
  }

  if (isAbsolute(configuredPath)) {
    return {
      runtimeFileName: configuredPath.split(/[/\\]/).pop() || DEFAULT_RUNTIME_FILE_NAME,
      runtimeFilePath: configuredPath,
    };
  }

  return {
    runtimeFileName: configuredPath.split(/[/\\]/).pop() || DEFAULT_RUNTIME_FILE_NAME,
    runtimeFilePath: join(resolveDataDir(), configuredPath),
  };
}

function normalizeLogin(login: string): string {
  return String(login ?? '').trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

@Injectable()
export class RuntimeCharacterStore {
  private readonly runtimeFilePath: string;
  private readonly runtimeFileName: string;

  constructor() {
    const resolved = resolveRuntimeFilePath();
    this.runtimeFileName = resolved.runtimeFileName;
    this.runtimeFilePath = resolved.runtimeFilePath;
    this.ensureRuntimeFile();
  }

  getRuntimeFileName(): string {
    return this.runtimeFileName;
  }

  getRuntimeFilePath(): string {
    return this.runtimeFilePath;
  }

  getStorageHealth(): { runtimeStorage: 'readable-writable' | 'unavailable' } {
    try {
      const runtime = this.readRuntime();
      if (!runtime.runtime || !Array.isArray(runtime.runtime.accounts) || !Array.isArray(runtime.runtime.characters)) {
        return { runtimeStorage: 'unavailable' };
      }
      return { runtimeStorage: 'readable-writable' };
    } catch {
      return { runtimeStorage: 'unavailable' };
    }
  }

  async upsertAccount(accountId: string): Promise<RuntimeAccountRecord> {
    const id = String(accountId ?? '').trim();
    if (!id) {
      throw new Error('Account id is required.');
    }

    const runtime = this.readRuntime();
    const existing = runtime.runtime.accounts.find((account) => account.id === id);
    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    const account: RuntimeAccountRecord = {
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    runtime.runtime.accounts.push(account);
    this.writeRuntime(runtime);
    return account;
  }

  async findAccountByLogin(login: string): Promise<RuntimeAccountRecord | undefined> {
    const normalized = normalizeLogin(login);
    if (!normalized) {
      return undefined;
    }

    const runtime = this.readRuntime();
    return runtime.runtime.accounts.find((account) => normalizeLogin(account.login ?? '') === normalized);
  }

  async createAuthAccount(input: { login: string; passwordHash: string }): Promise<RuntimeAccountRecord> {
    const login = String(input.login ?? '').trim();
    const passwordHash = String(input.passwordHash ?? '').trim();
    if (!login || !passwordHash) {
      throw new Error('Login and password hash are required.');
    }

    const timestamp = nowIso();
    const runtime = this.readRuntime();
    const account: RuntimeAccountRecord = {
      id: `local_account_${randomUUID()}`,
      login,
      passwordHash,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    runtime.runtime.accounts.push(account);
    this.writeRuntime(runtime);
    return account;
  }

  async createCharacter(character: RuntimeCharacterRecord): Promise<RuntimeCharacterRecord> {
    const runtime = this.readRuntime();
    runtime.runtime.characters.push({ ...character });
    this.writeRuntime(runtime);
    return character;
  }

  async listCharacters(accountId?: string): Promise<RuntimeCharacterRecord[]> {
    const normalizedAccountId = String(accountId ?? '').trim();
    const runtime = this.readRuntime();

    const list = normalizedAccountId
      ? runtime.runtime.characters.filter((character) => character.accountId === normalizedAccountId)
      : runtime.runtime.characters;

    return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async getCharacterById(id: string): Promise<RuntimeCharacterRecord | null> {
    const runtime = this.readRuntime();
    const character = runtime.runtime.characters.find((entry) => entry.id === id);
    return character ? { ...character } : null;
  }

  async updateCharacter(id: string, payload: Record<string, unknown>): Promise<RuntimeCharacterRecord | null> {
    const runtime = this.readRuntime();
    const index = runtime.runtime.characters.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return null;
    }

    const current = runtime.runtime.characters[index];
    const updated: RuntimeCharacterRecord = {
      ...current,
      ...payload,
      id: current.id,
      accountId: current.accountId,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    };

    runtime.runtime.characters[index] = updated;
    this.writeRuntime(runtime);
    return { ...updated };
  }

  async deleteCharacter(id: string): Promise<boolean> {
    const runtime = this.readRuntime();
    const before = runtime.runtime.characters.length;
    runtime.runtime.characters = runtime.runtime.characters.filter((entry) => entry.id !== id);

    if (runtime.runtime.characters.length === before) {
      return false;
    }

    this.writeRuntime(runtime);
    return true;
  }

  async readArenaData(key: string): Promise<unknown> {
    const runtime = this.readRuntime();
    const arenaData = runtime.runtime.arenaData ?? {};
    return arenaData[key];
  }

  async writeArenaData(key: string, value: unknown): Promise<void> {
    const runtime = this.readRuntime();
    if (!runtime.runtime.arenaData) {
      runtime.runtime.arenaData = {};
    }
    runtime.runtime.arenaData[key] = value;
    this.writeRuntime(runtime);
  }

  private ensureRuntimeFile(): void {
    const dirPath = dirname(this.runtimeFilePath);
    mkdirSync(dirPath, { recursive: true });

    if (!existsSync(this.runtimeFilePath)) {
      this.writeRuntime(this.createEmptyRuntime());
      return;
    }

    const runtime = this.readRuntime();
    if (!runtime.runtime || !Array.isArray(runtime.runtime.accounts) || !Array.isArray(runtime.runtime.characters)) {
      this.writeRuntime(this.createEmptyRuntime());
    }
  }

  private createEmptyRuntime(): RuntimeDataFile {
    return {
      schemaVersion: RUNTIME_SCHEMA_VERSION,
      runtime: {
        accounts: [],
        characters: [],
        arenaData: {},
      },
    };
  }

  private readRuntime(): RuntimeDataFile {
    try {
      const raw = readFileSync(this.runtimeFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RuntimeDataFile>;
      const accounts = Array.isArray(parsed.runtime?.accounts) ? parsed.runtime.accounts : [];
      const characters = Array.isArray(parsed.runtime?.characters) ? parsed.runtime.characters : [];
      const arenaData = typeof parsed.runtime?.arenaData === 'object' ? parsed.runtime.arenaData : {};

      return {
        schemaVersion: Number(parsed.schemaVersion ?? RUNTIME_SCHEMA_VERSION),
        runtime: {
          accounts,
          characters,
          arenaData,
        },
      };
    } catch {
      return this.createEmptyRuntime();
    }
  }

  private writeRuntime(data: RuntimeDataFile): void {
    const tempPath = `${this.runtimeFilePath}.${process.pid}.tmp`;
    const payload = `${JSON.stringify(data, null, 2)}\n`;

    writeFileSync(tempPath, payload, 'utf8');
    renameSync(tempPath, this.runtimeFilePath);
  }
}
