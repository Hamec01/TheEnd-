function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function setPlayerTarget(player, x, y) {
    return {
        ...player,
        targetX: clamp01(x),
        targetY: clamp01(y),
    };
}
export function tickPlayerMovement(player, epsilon = 0.0012, canMoveTo) {
    if (player.targetX === null || player.targetY === null) {
        return {
            player,
            state: 'idle',
            reachedTarget: false,
        };
    }
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < epsilon) {
        return {
            player: {
                ...player,
                x: player.targetX,
                y: player.targetY,
                targetX: null,
                targetY: null,
            },
            state: 'idle',
            reachedTarget: true,
        };
    }
    const step = Math.min(player.speed, distance);
    const nextX = clamp01(player.x + (dx / distance) * step);
    const nextY = clamp01(player.y + (dy / distance) * step);
    if (canMoveTo && !canMoveTo(nextX, nextY)) {
        return {
            player: {
                ...player,
                targetX: null,
                targetY: null,
            },
            state: 'idle',
            reachedTarget: false,
        };
    }
    return {
        player: {
            ...player,
            x: nextX,
            y: nextY,
        },
        state: 'moving',
        reachedTarget: false,
    };
}
