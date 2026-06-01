export interface ActivationContextMatchResult {
  ok: boolean;
  matched: string[];
  reason?: string;
}

export function normalizeActivationContextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const entry of value) {
    const normalized = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }

  return [...unique];
}

export function matchActivationContexts(
  requiredContexts: string[],
  availableContexts: string[],
): ActivationContextMatchResult {
  if (requiredContexts.length === 0) {
    return { ok: true, matched: [] };
  }

  const availableSet = new Set(availableContexts);
  const matched = requiredContexts.filter((entry) => availableSet.has(entry));
  if (matched.length > 0) {
    return { ok: true, matched };
  }

  return {
    ok: false,
    matched: [],
    reason: `Activation context mismatch: required one of [${requiredContexts.join(', ')}].`,
  };
}
