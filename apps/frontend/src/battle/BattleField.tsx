import {
  BATTLEFIELD_GRID_SIZE,
  DistanceBand,
  TeamSide,
  getBattlefieldTilePlacements,
  getDistanceBandForGap,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';

interface BattleFieldProps {
  entities: ArenaCombatEntity[];
  distance: DistanceBand;
  selectedTargetId: string | null;
  moveSelectionEnabled?: boolean;
  selectedMoveTile?: { x: number; y: number } | null;
  onMoveTileSelect?: (tile: { x: number; y: number; distanceBand: DistanceBand }) => void;
}

export function BattleField({ entities, distance, selectedTargetId, moveSelectionEnabled = false, selectedMoveTile, onMoveTileSelect }: BattleFieldProps) {
  const placements = getBattlefieldTilePlacements(entities, distance);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const placementByTile = new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement]));
  const targetPlacement = placements.find((placement) => placement.entityId === selectedTargetId) ?? null;
  const tiles = Array.from({ length: BATTLEFIELD_GRID_SIZE * BATTLEFIELD_GRID_SIZE }, (_, index) => {
    const x = index % BATTLEFIELD_GRID_SIZE;
    const y = Math.floor(index / BATTLEFIELD_GRID_SIZE);
    return { x, y, placement: placementByTile.get(`${x}:${y}`) };
  });

  return (
    <div className="battle-field">
      <div className="battle-field-head">
        <div className="distance-pill">Дистанция: {distance}</div>
        <div className="distance-grid">
          <span className={distance === DistanceBand.Melee ? 'active' : ''}>БЛИЖНЯЯ</span>
          <span className={distance === DistanceBand.Near ? 'active' : ''}>СРЕДНЯЯ</span>
          <span className={distance === DistanceBand.Far ? 'active' : ''}>ДАЛЬНЯЯ</span>
        </div>
      </div>

      <div className="battle-grid-shell">
        <div className="battle-grid-legend battle-grid-legend-top">
          {Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, index) => (
            <span key={`col-${index}`}>{index + 1}</span>
          ))}
        </div>

        <div className="battle-grid-body">
          <div className="battle-grid-legend battle-grid-legend-side">
            {Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, index) => (
              <span key={`row-${index}`}>{index + 1}</span>
            ))}
          </div>

          <div className="battle-grid-map">
            {tiles.map((tile) => {
              const fighter = tile.placement ? entityById.get(tile.placement.entityId) : undefined;
              const occupied = Boolean(fighter);
              const tileClassName = [
                'battle-grid-tile',
                occupied ? 'occupied' : '',
                tile.placement?.team === TeamSide.Left ? 'ally' : '',
                tile.placement?.team === TeamSide.Right ? 'enemy' : '',
                fighter?.id === selectedTargetId ? 'targeted' : '',
                selectedMoveTile && selectedMoveTile.x === tile.x && selectedMoveTile.y === tile.y ? 'selected-move' : '',
                moveSelectionEnabled && !occupied ? 'is-clickable' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={`${tile.x}-${tile.y}`}
                  className={tileClassName}
                  onClick={() => {
                    if (!moveSelectionEnabled || occupied || !targetPlacement || !onMoveTileSelect) {
                      return;
                    }

                    onMoveTileSelect({
                      x: tile.x,
                      y: tile.y,
                      distanceBand: getDistanceBandForGap(Math.abs(tile.x - targetPlacement.x)),
                    });
                  }}
                >
                  {fighter ? (
                    <>
                      <span className="battle-grid-unit-badge">{tile.placement?.team === TeamSide.Left ? 'P' : 'E'}</span>
                      <strong>{fighter.name}</strong>
                      <span>{fighter.currentHp}/{fighter.maxHp} HP</span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="battle-grid-footnote muted">
        Карта 12x12: Move позволяет выбрать клетку, а дистанция обновляется по реальным позициям бойцов.
      </div>
    </div>
  );
}

export function splitTeams(entities: ArenaCombatEntity[]) {
  return {
    leftTeam: entities.filter((item) => item.team === TeamSide.Left),
    rightTeam: entities.filter((item) => item.team === TeamSide.Right),
  };
}
