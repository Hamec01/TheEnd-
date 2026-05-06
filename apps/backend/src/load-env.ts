import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

for (const filePath of [join(process.cwd(), '.env'), join(process.cwd(), '.env.local')]) {
  if (!existsSync(filePath)) {
    continue;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (parsed && process.env[parsed[0]] === undefined) {
      process.env[parsed[0]] = parsed[1];
    }
  }
}
