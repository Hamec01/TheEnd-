const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const CHARACTER_ID = process.env.SMOKE_CHARACTER_ID || '7f2ad999-7d95-4a4d-910d-3fc6796047cf';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function http(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function getEntity(state, id) {
  return state.entities.find((e) => e.id === id) || null;
}

function getEnemy(state, playerId) {
  const player = getEntity(state, playerId);
  if (!player) return null;
  return state.entities.find((e) => e.team !== player.team && e.isAlive) || null;
}

function manhattan(a, b) {
  return Math.abs((a.x ?? 0) - (b.x ?? 0)) + Math.abs((a.y ?? 0) - (b.y ?? 0));
}

function buildCommand(type, target, payload = {}) {
  return { type, target, payload };
}

function findAdjacentFreeCell(state, targetEntity) {
  const offsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const d of offsets) {
    const x = (targetEntity.battlefieldX ?? 0) + d.x;
    const y = (targetEntity.battlefieldY ?? 0) + d.y;
    if (x < 0 || y < 0 || x >= state.battleMapWidth || y >= state.battleMapHeight) {
      continue;
    }
    const occupied = state.entities.some((e) => e.isAlive && (e.battlefieldX ?? 0) === x && (e.battlefieldY ?? 0) === y);
    if (occupied) continue;
    const tile = state.battlefieldTiles.find((t) => t.x === x && t.y === y);
    const blocked = tile?.blocksMovement === true || tile?.type === 'blocked' || tile?.type === 'highCover' || tile?.type === 'summon';
    if (!blocked) return { x, y };
  }
  return null;
}

function isCellWalkable(state, actorId, x, y) {
  if (x < 0 || y < 0 || x >= state.battleMapWidth || y >= state.battleMapHeight) {
    return false;
  }
  const occupied = state.entities.some((e) => e.id !== actorId && e.isAlive && (e.battlefieldX ?? 0) === x && (e.battlefieldY ?? 0) === y);
  if (occupied) return false;
  const tile = state.battlefieldTiles.find((t) => t.x === x && t.y === y);
  const blocked = tile?.blocksMovement === true || tile?.type === 'blocked' || tile?.type === 'highCover' || tile?.type === 'summon';
  return !blocked;
}

function findFreeCellAtDistance(state, actorId, origin, distance) {
  for (let dx = -distance; dx <= distance; dx += 1) {
    const dyAbs = distance - Math.abs(dx);
    const candidates = [
      { x: origin.x + dx, y: origin.y + dyAbs },
      { x: origin.x + dx, y: origin.y - dyAbs },
    ];
    for (const c of candidates) {
      if (isCellWalkable(state, actorId, c.x, c.y)) {
        return c;
      }
    }
  }
  return null;
}

async function startCombat(enemyCount = 1) {
  const started = await http('/combat/start', {
    method: 'POST',
    body: { characterId: CHARACTER_ID, enemyCount },
  });
  if (!started.ok) {
    throw new Error(`startCombat failed: ${JSON.stringify(started.data)}`);
  }
  return started.data;
}

async function action(battleId, actorId, roundNumber, command) {
  return http(`/combat/${battleId}/action`, {
    method: 'POST',
    body: { actorId, roundNumber, command },
  });
}

function isActionSuccess(response) {
  return Boolean(response?.data?.ok === true);
}

function isActionFailure(response) {
  return Boolean(response?.data?.ok === false);
}

async function getState(combatId) {
  return http(`/combat/${combatId}`);
}

async function ensureHealth() {
  const health = await http('/health');
  if (!health.ok || !health.data?.ok) {
    throw new Error(`health check failed: ${JSON.stringify(health.data)}`);
  }
}

async function scenario1_startCombat() {
  const started = await startCombat(1);
  const state = started.state;
  const playerId = started.playerId;
  const player = getEntity(state, playerId);
  const pass = Boolean(
    state.phase === 'acting'
    && state.activeActorId
    && Array.isArray(state.turnQueue)
    && state.turnQueue.length > 0
    && state.turnIndex === 0
    && typeof state.currentTurnAp === 'number'
    && (state.currentTurnAp === 3 || state.currentTurnAp === 4)
    && state.turnDurationSeconds === 30
    && typeof state.turnDeadlineAt === 'string'
    && state.activeActorId === playerId
    && player
  );

  return {
    pass,
    battleId: started.combatId,
    playerId,
    data: {
      phase: state.phase,
      activeActorId: state.activeActorId,
      turnQueue: state.turnQueue,
      turnIndex: state.turnIndex,
      currentTurnAp: state.currentTurnAp,
      turnDurationSeconds: state.turnDurationSeconds,
      turnDeadlineAt: state.turnDeadlineAt,
    },
  };
}

async function scenario2_wait() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);

  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('wait', { kind: 'self' }));
  const afterState = (res.data?.battleState) || (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);

  const pass = Boolean(
    isActionSuccess(res)
    && beforePlayer
    && afterPlayer
    && beforePlayer.currentStamina === afterPlayer.currentStamina
    && ((beforeState.activeActorId !== afterState.activeActorId) || (res.data?.events ?? []).some((e) => e.actorId && e.actorId !== playerId))
  );

  return {
    pass,
    data: {
      staminaBefore: beforePlayer?.currentStamina,
      staminaAfter: afterPlayer?.currentStamina,
      activeActorBefore: beforeState.activeActorId,
      activeActorAfter: afterState.activeActorId,
      events: res.data?.events ?? [],
    },
  };
}

async function scenario3_moveValid() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);
  const enemy = getEnemy(beforeState, playerId);

  if (!beforePlayer || !enemy) {
    return { pass: false, data: { reason: 'player_or_enemy_missing' } };
  }

  const beforePos = { x: beforePlayer.battlefieldX, y: beforePlayer.battlefieldY };
  const destination = findFreeCellAtDistance(beforeState, playerId, beforePos, 1);
  if (!destination) {
    return { pass: false, data: { reason: 'no_free_cell_distance_1' } };
  }
  const beforeSta = beforePlayer.currentStamina;
  const beforeAp = beforeState.currentTurnAp;

  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('move', { kind: 'cell', x: destination.x, y: destination.y }));
  const afterState = (res.data?.battleState) || (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);
  const movementEvent = (res.data?.events ?? []).find((e) => e.type === 'movement');
  const eventCost = movementEvent?.data?.resourceCost;

  const pass = Boolean(
    isActionSuccess(res)
    && afterPlayer
    && (afterPlayer.battlefieldX !== beforePos.x || afterPlayer.battlefieldY !== beforePos.y)
    && typeof beforeAp === 'number'
    && typeof afterState.currentTurnAp === 'number'
    && afterState.currentTurnAp === beforeAp - 1
    && afterPlayer.currentStamina === beforeSta - 10
    && eventCost?.stamina === 10
    && eventCost?.ap === 1
    && movementEvent?.data?.distance === 1
    && movementEvent?.data?.from
    && movementEvent?.data?.to
    && afterState.activeActorId === playerId
  );

  return {
    pass,
    data: {
      positionBefore: beforePos,
      positionAfter: { x: afterPlayer?.battlefieldX, y: afterPlayer?.battlefieldY },
      staminaBefore: beforeSta,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: beforeAp,
      apAfter: afterState.currentTurnAp,
      expectedCost: { ap: 1, stamina: 10 },
      movementEvent,
    },
  };
}

async function scenario4_invalidMove() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);
  const enemy = getEnemy(beforeState, playerId);

  if (!beforePlayer || !enemy) {
    return { pass: false, data: { reason: 'player_or_enemy_missing' } };
  }

  const beforePos = { x: beforePlayer.battlefieldX, y: beforePlayer.battlefieldY };
  const beforeSta = beforePlayer.currentStamina;
  const beforeAp = beforeState.currentTurnAp;

  const invalidTarget = { kind: 'cell', x: (beforePlayer.battlefieldX ?? 0) + 10, y: beforePlayer.battlefieldY ?? 0 };
  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('move', invalidTarget));
  const afterState = (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);

  const pass = Boolean(
    isActionFailure(res)
    && afterPlayer
    && afterPlayer.battlefieldX === beforePos.x
    && afterPlayer.battlefieldY === beforePos.y
    && afterPlayer.currentStamina === beforeSta
    && afterState.currentTurnAp === beforeAp
    && (String(res.data?.errorCode ?? '').includes('MOVEMENT_TOO_FAR') || String(res.data?.errorCode ?? '').includes('INVALID_MOVE_DISTANCE'))
    && ((afterState.recentCombatEvents ?? []).some((e) => e.type === 'command_failed'))
  );

  return {
    pass,
    data: {
      positionBefore: beforePos,
      positionAfter: { x: afterPlayer?.battlefieldX, y: afterPlayer?.battlefieldY },
      staminaBefore: beforeSta,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: beforeAp,
      apAfter: afterState.currentTurnAp,
      expectedNoCost: true,
      error: res.data,
    },
  };
}

async function scenario11_moveTwoCellsCost() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);

  if (!beforePlayer) {
    return { pass: false, data: { reason: 'player_missing' } };
  }

  const beforePos = { x: beforePlayer.battlefieldX ?? 0, y: beforePlayer.battlefieldY ?? 0 };
  const destination = findFreeCellAtDistance(beforeState, playerId, beforePos, 2);
  if (!destination) {
    return { pass: false, data: { reason: 'no_free_cell_distance_2' } };
  }

  const beforeSta = beforePlayer.currentStamina;
  const beforeAp = beforeState.currentTurnAp;
  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('move', { kind: 'cell', x: destination.x, y: destination.y }));
  const afterState = res.data?.battleState ?? (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);
  const movementEvent = (res.data?.events ?? []).find((e) => e.type === 'movement');
  const eventCost = movementEvent?.data?.resourceCost;

  const pass = Boolean(
    isActionSuccess(res)
    && afterPlayer
    && afterPlayer.currentStamina === beforeSta - 20
    && afterState.currentTurnAp === beforeAp - 1
    && movementEvent?.data?.distance === 2
    && eventCost?.stamina === 20
    && eventCost?.ap === 1
  );

  return {
    pass,
    data: {
      positionBefore: beforePos,
      positionAfter: { x: afterPlayer?.battlefieldX, y: afterPlayer?.battlefieldY },
      staminaBefore: beforeSta,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: beforeAp,
      apAfter: afterState.currentTurnAp,
      expectedCost: { ap: 1, stamina: 20 },
      movementEvent,
    },
  };
}

async function scenario12_dashThreeCellsCost() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);

  if (!beforePlayer) {
    return { pass: false, data: { reason: 'player_missing' } };
  }

  const beforePos = { x: beforePlayer.battlefieldX ?? 0, y: beforePlayer.battlefieldY ?? 0 };
  const destination = findFreeCellAtDistance(beforeState, playerId, beforePos, 3);
  if (!destination) {
    return { pass: false, data: { reason: 'no_free_cell_distance_3' } };
  }

  const beforeSta = beforePlayer.currentStamina;
  const beforeAp = beforeState.currentTurnAp;
  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('dash', { kind: 'cell', x: destination.x, y: destination.y }));
  const afterState = res.data?.battleState ?? (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);
  const movementEvent = (res.data?.events ?? []).find((e) => e.type === 'movement');
  const eventCost = movementEvent?.data?.resourceCost;

  const pass = Boolean(
    isActionSuccess(res)
    && afterPlayer
    && afterPlayer.currentStamina === beforeSta - 30
    && afterState.currentTurnAp === beforeAp - 2
    && movementEvent?.data?.distance === 3
    && movementEvent?.data?.movementType === 'dash'
    && eventCost?.stamina === 30
    && eventCost?.ap === 2
  );

  return {
    pass,
    data: {
      positionBefore: beforePos,
      positionAfter: { x: afterPlayer?.battlefieldX, y: afterPlayer?.battlefieldY },
      staminaBefore: beforeSta,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: beforeAp,
      apAfter: afterState.currentTurnAp,
      expectedCost: { ap: 2, stamina: 30 },
      movementEvent,
    },
  };
}

async function scenario13_dashTooFarFails() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);

  if (!beforePlayer) {
    return { pass: false, data: { reason: 'player_missing' } };
  }

  const beforePos = { x: beforePlayer.battlefieldX ?? 0, y: beforePlayer.battlefieldY ?? 0 };
  const beforeSta = beforePlayer.currentStamina;
  const beforeAp = beforeState.currentTurnAp;
  const target = { kind: 'cell', x: beforePos.x + 4, y: beforePos.y };
  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('dash', target));
  const afterState = (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);

  const pass = Boolean(
    isActionFailure(res)
    && afterPlayer
    && afterPlayer.battlefieldX === beforePos.x
    && afterPlayer.battlefieldY === beforePos.y
    && afterPlayer.currentStamina === beforeSta
    && afterState.currentTurnAp === beforeAp
    && String(res.data?.errorCode ?? '').includes('DASH_TOO_FAR')
    && (afterState.recentCombatEvents ?? []).some((e) => e.type === 'command_failed')
  );

  return {
    pass,
    data: {
      positionBefore: beforePos,
      positionAfter: { x: afterPlayer?.battlefieldX, y: afterPlayer?.battlefieldY },
      staminaBefore: beforeSta,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: beforeAp,
      apAfter: afterState.currentTurnAp,
      expectedNoCost: true,
      error: res.data,
    },
  };
}

async function scenario5_attackInRange() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  let state = started.state;
  let player = getEntity(state, playerId);
  let enemy = getEnemy(state, playerId);
  if (!player || !enemy) {
    return { pass: false, data: { reason: 'player_or_enemy_missing' } };
  }

  let safety = 0;
  while (safety < 12) {
    player = getEntity(state, playerId);
    enemy = getEnemy(state, playerId);
    if (!player || !enemy) {
      return { pass: false, data: { reason: 'entities_missing_during_setup' } };
    }

    const dist = manhattan(
      { x: player.battlefieldX ?? 0, y: player.battlefieldY ?? 0 },
      { x: enemy.battlefieldX ?? 0, y: enemy.battlefieldY ?? 0 },
    );

    if (state.activeActorId === playerId && dist <= 3) {
      break;
    }

    if (state.activeActorId === playerId) {
      const waitRes = await action(combatId, playerId, state.roundNumber, buildCommand('wait', { kind: 'self' }));
      state = waitRes.data?.battleState ?? (await getState(combatId)).data;
    } else {
      state = (await getState(combatId)).data;
    }

    safety += 1;
  }

  player = getEntity(state, playerId);
  enemy = getEnemy(state, playerId);
  if (!player || !enemy) {
    return { pass: false, data: { reason: 'entities_missing_after_setup' } };
  }

  const range = Math.max(1, Math.floor(player.attackRange ?? 1));
  let finalDist = manhattan(
    { x: player.battlefieldX ?? 0, y: player.battlefieldY ?? 0 },
    { x: enemy.battlefieldX ?? 0, y: enemy.battlefieldY ?? 0 },
  );

  if (state.activeActorId === playerId && finalDist > range && finalDist <= 3) {
    const dx = Math.sign((enemy.battlefieldX ?? 0) - (player.battlefieldX ?? 0));
    const dy = Math.sign((enemy.battlefieldY ?? 0) - (player.battlefieldY ?? 0));
    const moveCandidates = [
      { x: (player.battlefieldX ?? 0) + dx * 2, y: player.battlefieldY ?? 0 },
      { x: (player.battlefieldX ?? 0) + dx, y: player.battlefieldY ?? 0 },
      { x: player.battlefieldX ?? 0, y: (player.battlefieldY ?? 0) + dy * 2 },
      { x: player.battlefieldX ?? 0, y: (player.battlefieldY ?? 0) + dy },
    ];
    for (const cell of moveCandidates) {
      if (!isCellWalkable(state, playerId, cell.x, cell.y)) {
        continue;
      }
      const moveRes = await action(combatId, playerId, state.roundNumber, buildCommand('move', { kind: 'cell', x: cell.x, y: cell.y }));
      if (isActionSuccess(moveRes)) {
        state = moveRes.data?.battleState ?? (await getState(combatId)).data;
        break;
      }
    }
  }

  player = getEntity(state, playerId);
  enemy = getEnemy(state, playerId);
  finalDist = (!player || !enemy) ? Number.POSITIVE_INFINITY : manhattan(
    { x: player.battlefieldX ?? 0, y: player.battlefieldY ?? 0 },
    { x: enemy.battlefieldX ?? 0, y: enemy.battlefieldY ?? 0 },
  );
  if (!player || !enemy || state.activeActorId !== playerId || finalDist > range) {
    return { pass: false, data: { reason: 'could_not_reach_attack_range', finalDist, range, activeActorId: state.activeActorId } };
  }

  const hpBefore = enemy.currentHp;
  const staBefore = player.currentStamina;
  const apBefore = state.currentTurnAp;

  const res = await action(combatId, playerId, state.roundNumber, buildCommand('basic_attack', { kind: 'entity', entityId: enemy.id }));
  const afterState = res.data?.battleState ?? (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);
  const afterEnemy = getEntity(afterState, enemy.id);
  const dmgEvent = (res.data?.events ?? []).find((e) => e.type === 'damage' && e.targetId === enemy.id);
  const finalDamage = Number(dmgEvent?.data?.finalDamage ?? dmgEvent?.data?.amount ?? 0);
  const hpDiff = (hpBefore ?? 0) - (afterEnemy?.currentHp ?? hpBefore);

  const pass = Boolean(
    isActionSuccess(res)
    && afterPlayer
    && afterEnemy
    && apBefore - afterState.currentTurnAp === 1
    && staBefore - afterPlayer.currentStamina === 20
    && hpDiff >= 0
    && finalDamage >= 0
    && hpDiff === finalDamage
    && dmgEvent?.data?.resourceCost?.stamina === 20
    && dmgEvent?.data?.beforeHp === hpBefore
    && dmgEvent?.data?.afterHp === afterEnemy.currentHp
  );

  return {
    pass,
    data: {
      targetHpBefore: hpBefore,
      targetHpAfter: afterEnemy?.currentHp,
      staminaBefore: staBefore,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: apBefore,
      apAfter: afterState.currentTurnAp,
      damageEvent: dmgEvent,
      hpDiff,
      finalDamage,
      hpDiffMatchesFinalDamage: hpDiff === finalDamage,
      distanceBeforeAttack: finalDist,
      attackRange: range,
    },
  };
}

async function scenario6_attackOutOfRange() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  let state = started.state;
  let player = getEntity(state, playerId);
  const enemy = getEnemy(state, playerId);

  if (!player || !enemy) {
    return { pass: false, data: { reason: 'player_or_enemy_missing' } };
  }

  const refreshedEnemy = getEntity(state, enemy.id);

  if (!player || !refreshedEnemy) {
    return { pass: false, data: { reason: 'entities_missing_after_setup' } };
  }

  const hpBefore = refreshedEnemy.currentHp;
  const staBefore = player.currentStamina;
  const apBefore = state.currentTurnAp;

  const res = await action(combatId, playerId, state.roundNumber, buildCommand('basic_attack', { kind: 'entity', entityId: refreshedEnemy.id }));
  const afterState = (await getState(combatId)).data;
  const afterPlayer = getEntity(afterState, playerId);
  const afterEnemy = getEntity(afterState, refreshedEnemy.id);

  const pass = Boolean(
    isActionFailure(res)
    && afterPlayer
    && afterEnemy
    && afterEnemy.currentHp === hpBefore
    && afterPlayer.currentStamina === staBefore
    && afterState.currentTurnAp === apBefore
    && String(res.data?.errorCode ?? '').includes('TARGET_OUT_OF_RANGE')
    && ((afterState.recentCombatEvents ?? []).some((e) => e.type === 'command_failed'))
  );

  return {
    pass,
    data: {
      targetHpBefore: hpBefore,
      targetHpAfter: afterEnemy?.currentHp,
      staminaBefore: staBefore,
      staminaAfter: afterPlayer?.currentStamina,
      apBefore: apBefore,
      apAfter: afterState.currentTurnAp,
      error: res.data,
    },
  };
}

async function scenario7_aiTurn() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;

  const res = await action(combatId, playerId, beforeState.roundNumber, buildCommand('wait', { kind: 'self' }));
  const afterState = res.data?.battleState ?? (await getState(combatId)).data;
  const aiActors = afterState.entities.filter((e) => e.id !== playerId && e.team !== getEntity(afterState, playerId)?.team);
  const eventActors = new Set((res.data?.events ?? []).map((e) => e.actorId).filter(Boolean));
  const aiActorIds = new Set(aiActors.map((e) => e.id));
  const aiEventSeen = [...eventActors].some((id) => aiActorIds.has(id));

  const pass = Boolean(
    isActionSuccess(res)
    && beforeState.activeActorId === playerId
    && (afterState.activeActorId === playerId || aiActorIds.has(afterState.activeActorId))
    && aiEventSeen
    && !(afterState.phase === 'planning' || afterState.roundPhase === 'PLANNING')
  );

  return {
    pass,
    data: {
      activeActorBefore: beforeState.activeActorId,
      activeActorAfter: afterState.activeActorId,
      aiAutoStarted: aiEventSeen,
      aiEvents: (res.data?.events ?? []).filter((e) => aiActorIds.has(e.actorId)),
      returnedToPlayerOrNextActor: afterState.activeActorId,
      phase: afterState.phase,
      roundPhase: afterState.roundPhase,
      pendingActorIds: afterState.pendingActorIds,
      readyActorIds: afterState.readyActorIds,
    },
  };
}

async function scenario8_fullQueueCycle() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;

  let state = beforeState;
  let safety = 0;
  while (state.roundNumber === beforeState.roundNumber && safety < 8) {
    const actorId = state.activeActorId;
    if (actorId !== playerId) {
      const next = await getState(combatId);
      state = next.data;
      safety += 1;
      continue;
    }

    const stepped = await action(combatId, playerId, state.roundNumber, buildCommand('wait', { kind: 'self' }));
    state = stepped.data?.battleState ?? (await getState(combatId)).data;
    safety += 1;
  }

  const pass = Boolean(
    state.roundNumber > beforeState.roundNumber
    && state.activeActorId === playerId
    && typeof state.currentTurnAp === 'number'
    && state.currentTurnAp > 0
  );

  return {
    pass,
    data: {
      roundNumberBefore: beforeState.roundNumber,
      roundNumberAfter: state.roundNumber,
      turnIndexBefore: beforeState.turnIndex,
      turnIndexAfter: state.turnIndex,
      activeActorAfter: state.activeActorId,
      apAfter: state.currentTurnAp,
      queue: state.turnQueue,
    },
  };
}

async function scenario9_timeout() {
  const started = await startCombat(1);
  const { combatId, playerId } = started;
  const beforeState = started.state;
  const beforePlayer = getEntity(beforeState, playerId);
  const beforeActive = beforeState.activeActorId;

  const deadlineMs = Date.parse(beforeState.turnDeadlineAt);
  const now = Date.now();
  const waitMs = Number.isFinite(deadlineMs) ? Math.max(0, deadlineMs - now + 1200) : 31000;
  await sleep(waitMs);

  const timeoutStateResp = await getState(combatId);
  const afterState = timeoutStateResp.data;
  const afterPlayer = getEntity(afterState, playerId);

  const recent = afterState.recentCombatEvents ?? [];
  const timeoutEvent = recent.find((e) => e?.data?.reason === 'turn_timeout')
    || (afterState.logs ?? []).slice().reverse().find((e) => String(e.text ?? '').toLowerCase().includes('timed out') || String(e.text ?? '').toLowerCase().includes('автоматически завершает'));
  const guardSeen = recent.some((e) => e.type === 'guard_applied')
    || (afterState.logs ?? []).slice(-20).some((e) => String(e.text ?? '').toLowerCase().includes('guard'));

  const turnTransitionSeen = recent.some((e) => e.type === 'turn_changed' || e.type === 'turn_started' || e.type === 'turn_ended');
  const pass = Boolean(
    beforePlayer
    && afterPlayer
    && beforePlayer.currentStamina === afterPlayer.currentStamina
    && Boolean(timeoutEvent)
    && turnTransitionSeen
    && !guardSeen
  );

  return {
    pass,
    data: {
      staminaBefore: beforePlayer?.currentStamina,
      staminaAfter: afterPlayer?.currentStamina,
      activeActorBefore: beforeActive,
      activeActorAfter: afterState.activeActorId,
      timeoutEvent: timeoutEvent ?? null,
      recentEvents: recent,
      autoGuardSeen: guardSeen,
    },
  };
}

async function scenario10_legacyIsolation() {
  const source = await import('node:fs/promises');
  const text = await source.readFile('apps/backend/src/combat/combat.service.ts', 'utf8');
  const fnStart = text.indexOf('async executeSequentialAction(payload:');
  const fnEnd = text.indexOf('async submitCombatPlanV2(', fnStart + 1);
  const fnBody = fnStart >= 0 && fnEnd > fnStart ? text.slice(fnStart, fnEnd) : '';

  const hasPlanCallsInAction = /getOrCreateTurnPlan|plan\.commands|tryResolveWhenAllReady|setTurnPlanReady/.test(fnBody);
  const hasLegacyPlanSymbols = /getOrCreateTurnPlan|tryResolveWhenAllReady|setTurnPlanReady/.test(text);

  const pass = Boolean(!hasPlanCallsInAction && hasLegacyPlanSymbols);
  return {
    pass,
    data: {
      legacySymbolsPresentSomewhere: hasLegacyPlanSymbols,
      executeSequentialActionCallsPlanFlow: hasPlanCallsInAction,
      immediateExecutorCallPresent: /executeImmediateCombatCommand/.test(fnBody),
    },
  };
}

async function main() {
  await ensureHealth();

  const result = {};
  result.startCombat = await scenario1_startCombat();
  result.wait = await scenario2_wait();
  result.moveValid = await scenario3_moveValid();
  result.moveInvalid = await scenario4_invalidMove();
  result.moveTwoCellsCost = await scenario11_moveTwoCellsCost();
  result.dashThreeCellsCost = await scenario12_dashThreeCellsCost();
  result.dashTooFar = await scenario13_dashTooFarFails();
  result.basicAttackInRange = await scenario5_attackInRange();
  result.basicAttackOutOfRange = await scenario6_attackOutOfRange();
  result.aiTurn = await scenario7_aiTurn();
  result.fullQueueCycle = await scenario8_fullQueueCycle();
  result.timeout = await scenario9_timeout();
  result.legacyIsolation = await scenario10_legacyIsolation();

  result.futureRisk = {
    item: 'timeout_handler_session_gate',
    note: 'resolveActiveTurnTimeoutIfNeeded currently returns early when active actor is not session.playerId. This is acceptable for P0 single-player session ownership, but may be risky for future PvP/multi-session ticking where timeout should depend on active actor ownership model.'
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: String(error?.stack || error) }, null, 2));
  process.exit(1);
});
