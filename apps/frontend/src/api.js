const API_BASE = 'http://localhost:3001';
export async function registerAccount(payload) {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function createCharacter(payload, accountId) {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const res = await fetch(`${API_BASE}/characters${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function loginAccount(payload) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function listCharacters(accountId) {
    const res = await fetch(`${API_BASE}/characters?accountId=${encodeURIComponent(accountId)}`);
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function getArenaHubState(characterId) {
    const res = await fetch(`${API_BASE}/arena/hub/${encodeURIComponent(characterId)}`);
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
async function readErrorMessage(res) {
    const raw = await res.text();
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.message)) {
            return parsed.message.join(', ');
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
            return parsed.message;
        }
    }
    catch {
        // Fallback to raw text below.
    }
    return raw;
}
export async function buyArenaItem(characterId, itemId) {
    const res = await fetch(`${API_BASE}/arena/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, itemId }),
    });
    if (!res.ok) {
        throw new Error(await readErrorMessage(res));
    }
    return res.json();
}
export async function sellArenaItem(characterId, itemId, quantity = 1) {
    const res = await fetch(`${API_BASE}/arena/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, itemId, quantity }),
    });
    if (!res.ok) {
        throw new Error(await readErrorMessage(res));
    }
    return res.json();
}
export async function equipArenaItem(characterId, itemId) {
    const res = await fetch(`${API_BASE}/arena/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, itemId }),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function unequipArenaItem(characterId, slot) {
    const res = await fetch(`${API_BASE}/arena/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, slot }),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function startCombat(characterId, enemyCount = 1) {
    const res = await fetch(`${API_BASE}/combat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, enemyCount }),
    });
    if (!res.ok) {
        throw new Error(await readErrorMessage(res));
    }
    return res.json();
}
export async function startCustomCombat(characterId, customEnemies) {
    const res = await fetch(`${API_BASE}/combat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            characterId,
            enemyCount: Math.max(1, customEnemies.length),
            customEnemies,
        }),
    });
    if (!res.ok) {
        throw new Error(await readErrorMessage(res));
    }
    return res.json();
}
export async function sendCombatAction(payload) {
    const res = await fetch(`${API_BASE}/combat/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function allocateStats(characterId, allocation) {
    const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/allocate-stats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocation),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
export async function useCombatItem(payload) {
    const res = await fetch(`${API_BASE}/combat/use-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return res.json();
}
