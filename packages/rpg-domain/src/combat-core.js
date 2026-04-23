export function createCombatEntity(entity) {
    return {
        ...entity,
        defending: false,
        turnMeter: entity.derived.initiative,
        activeEffects: [],
    };
}
export function initializeCombat(participants) {
    const entities = participants.map(createCombatEntity);
    const turnOrder = [...entities]
        .sort((a, b) => b.derived.initiative - a.derived.initiative)
        .map((entity) => entity.id);
    return {
        participants: entities,
        turnOrder,
        currentTurnIndex: 0,
        finished: false,
    };
}
function findEntity(state, id) {
    const entity = state.participants.find((item) => item.id === id);
    if (!entity) {
        throw new Error(`Entity ${id} not found.`);
    }
    return entity;
}
function applyDamage(target, amount, damageType) {
    let effective = amount;
    if (damageType === 'magic') {
        effective = Math.round(effective * target.raceModifiers.magicDamageTakenMultiplier);
    }
    if (damageType === 'element') {
        effective = Math.round(effective * target.raceModifiers.elementDamageTakenMultiplier);
    }
    if (target.defending) {
        effective = Math.round(effective * 0.5);
    }
    target.currentHp = Math.max(0, target.currentHp - effective);
    target.isAlive = target.currentHp > 0;
}
function nextTurn(state) {
    if (state.finished) {
        return;
    }
    const alive = state.participants.filter((item) => item.isAlive);
    if (alive.length <= 1) {
        state.finished = true;
        state.winnerId = alive[0]?.id;
        return;
    }
    let nextIndex = state.currentTurnIndex;
    for (let i = 0; i < state.turnOrder.length; i += 1) {
        nextIndex = (nextIndex + 1) % state.turnOrder.length;
        const id = state.turnOrder[nextIndex];
        const entity = findEntity(state, id);
        if (entity.isAlive) {
            state.currentTurnIndex = nextIndex;
            break;
        }
    }
}
export function resolveAction(state, action) {
    if (state.finished) {
        return state;
    }
    const activeId = state.turnOrder[state.currentTurnIndex];
    if (activeId !== action.actorId) {
        throw new Error('Actor is not the current participant.');
    }
    const actor = findEntity(state, action.actorId);
    if (!actor.isAlive) {
        nextTurn(state);
        return state;
    }
    actor.defending = false;
    if (action.type === 'BASIC_ATTACK') {
        if (!action.targetId) {
            throw new Error('Target is required for BASIC_ATTACK.');
        }
        const target = findEntity(state, action.targetId);
        applyDamage(target, actor.derived.physicalDamage, 'physical');
    }
    else if (action.type === 'DEFEND') {
        actor.defending = true;
    }
    nextTurn(state);
    return state;
}
