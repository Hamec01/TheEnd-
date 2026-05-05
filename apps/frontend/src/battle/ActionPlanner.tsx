import {
  ActionType,
  DistanceBand,
  MovementType,
  TargetZone,
  getSkillCostSummary,
  type AdminSkillDefinition,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';
import { useMemo, useState } from 'react';

interface ActionPlannerProps {
  enemies: ArenaCombatEntity[];
  selectedTargetId: string;
  actionType: ActionType;
  attackZone: TargetZone;
  defenseZones: TargetZone[];
  currentDistance: DistanceBand;
  movementType: MovementType | null;
  selectedMoveTile?: { x: number; y: number } | null;
  currentStamina: number;
  maxStamina: number;
  currentMp: number;
  maxMp: number;
  availableSkills: Array<{ slotId: string; slotIndex: number; skillId: string; label: string; level: number; definition: AdminSkillDefinition }>;
  inventoryItems: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    itemType: string;
    quantity: number;
    disabled?: boolean;
    disabledReason?: string | null;
    effectSummary?: string | null;
    costSummary?: string | null;
  }>;
  selectedSkillId: string | null;
  actionWarning?: string | null;
  onActionTypeChange: (actionType: ActionType) => void;
  onSkillChange: (skillId: string | null) => void;
  onTargetChange: (id: string) => void;
  onAttackZoneChange: (zone: TargetZone) => void;
  onDefenseZonesChange: (zones: TargetZone[]) => void;
  onUseInventoryItem?: (itemId: string) => void | Promise<void>;
  onSubmit: () => void;
  disabled: boolean;
  showSubmitButton?: boolean;
  recentHitZone?: TargetZone | null;
  recentBlockedZone?: TargetZone | null;
}

type BodyZoneId = 'head' | 'chest' | 'stomach' | 'left_arm' | 'right_arm' | 'legs';

interface BodyZoneConfig {
  id: BodyZoneId;
  zone: TargetZone;
  title: string;
  label: string;
  hint: string;
}

const BODY_ZONES: BodyZoneConfig[] = [
  { id: 'head', zone: TargetZone.Head, title: 'Head / Голова', label: 'Голова', hint: 'Криты и давление.' },
  { id: 'left_arm', zone: TargetZone.LeftArm, title: 'Left Arm / Левая рука', label: 'Левая рука', hint: 'Сбивает темп и контроль.' },
  { id: 'right_arm', zone: TargetZone.RightArm, title: 'Right Arm / Правая рука', label: 'Правая рука', hint: 'Давление на оружейную руку.' },
  { id: 'chest', zone: TargetZone.Chest, title: 'Chest / Грудь', label: 'Грудь', hint: 'Надежная атакующая зона.' },
  { id: 'stomach', zone: TargetZone.Abdomen, title: 'Abdomen / Живот', label: 'Живот', hint: 'Рискованная центральная зона.' },
  { id: 'legs', zone: TargetZone.Legs, title: 'Legs / Ноги', label: 'Ноги', hint: 'Замедляет и срывает отход.' },
];

const DISTANCE_LABELS: Record<DistanceBand, string> = {
  [DistanceBand.Far]: 'ДАЛЕКО',
  [DistanceBand.Near]: 'СРЕДНЯЯ',
  [DistanceBand.Melee]: 'БЛИЖНЯЯ',
};

const MOVEMENT_LABELS: Record<MovementType, string> = {
  [MovementType.Step]: 'Move 1 cell',
  [MovementType.Extra]: 'Extra move 2 cells',
  [MovementType.Dash]: 'Dash up to 3 cells',
  [MovementType.Disengage]: 'Disengage 1 cell',
};

const MOVEMENT_COSTS: Record<MovementType, number> = {
  [MovementType.Step]: 6,
  [MovementType.Extra]: 16,
  [MovementType.Dash]: 14,
  [MovementType.Disengage]: 10,
};

const ACTION_COSTS: Record<ActionType, number> = {
  [ActionType.Attack]: 10,
  [ActionType.Defend]: 8,
  [ActionType.Move]: 0,
  [ActionType.Wait]: 0,
};

function getGuardLabel(defenseZones: TargetZone[]): string {
  if (defenseZones.length === 0) {
    return 'Без защиты';
  }
  if (defenseZones.length === 1) {
    return 'Агрессивная';
  }
  return 'Нормальная';
}

function getEstimatedTotalCost(actionType: ActionType, movementType: MovementType | null): number {
  return ACTION_COSTS[actionType] + (movementType ? MOVEMENT_COSTS[movementType] : 0);
}

function formatQuickSlotLabel(slotId: string): string {
  const match = slotId.match(/quick(\d+)/i);
  if (!match) {
    return slotId;
  }
  return `Q${match[1]}`;
}

interface BodyTargetSelectorProps {
  mode: 'attack' | 'defense';
  selectedZones: TargetZone[];
  maxSelections: number;
  onChange: (zones: TargetZone[]) => void;
  disabled?: boolean;
  title?: string;
  recentHitZone?: TargetZone | null;
  recentBlockedZone?: TargetZone | null;
}

function BodyTargetSelector({
  mode,
  selectedZones,
  maxSelections,
  onChange,
  disabled = false,
  title,
  recentHitZone,
  recentBlockedZone,
}: BodyTargetSelectorProps) {
  function toggleZone(zone: TargetZone): void {
    if (disabled) {
      return;
    }

    if (mode === 'attack') {
      onChange([zone]);
      return;
    }

    const alreadySelected = selectedZones.includes(zone);
    if (alreadySelected) {
      onChange(selectedZones.filter((item) => item !== zone));
      return;
    }

    const next = [...selectedZones, zone];
    if (next.length > maxSelections) {
      next.shift();
    }
    onChange(next);
  }

  return (
    <div className={`body-target-selector mode-${mode} ${disabled ? 'is-disabled' : ''}`}>
      {title ? <h4>{title}</h4> : null}
      <div className="body-silhouette" role="group" aria-label={title ?? mode}>
        {BODY_ZONES.map((item) => {
          const isSelected = selectedZones.includes(item.zone);
          const isHitFlash = recentHitZone === item.zone;
          const isBlockedFlash = recentBlockedZone === item.zone;
          const zoneClassName = [
            'body-zone',
            `zone-${item.id}`,
            isSelected ? 'is-selected' : '',
            isSelected && mode === 'attack' ? 'is-attack' : '',
            isSelected && mode === 'defense' ? 'is-defense' : '',
            isHitFlash ? 'is-hit-flash' : '',
            isBlockedFlash ? 'is-block-flash' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={`${mode}-${item.id}`}
              type="button"
              className={zoneClassName}
              onClick={() => toggleZone(item.zone)}
              title={`${item.title} | ${item.hint}`}
              disabled={disabled}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ActionPlanner(props: ActionPlannerProps) {
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const selectedDefenseZones = props.defenseZones.slice(0, 2);
  const skillOptions = props.availableSkills;
  const selectedInventoryEntry = useMemo(
    () => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null,
    [props.inventoryItems, selectedInventoryItem],
  );

  const estimatedCost = getEstimatedTotalCost(props.actionType, props.movementType);
  const selectedSkill = useMemo(
    () => props.availableSkills.find((skill) => skill.skillId === props.selectedSkillId) ?? null,
    [props.availableSkills, props.selectedSkillId],
  );
  const resourceSummary = useMemo(
    () => selectedSkill ? getSkillCostSummary(selectedSkill.definition, selectedSkill.level) : [],
    [selectedSkill],
  );
  const manaCost = useMemo(
    () => resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('mp') ? sum + entry.amount : sum, 0),
    [resourceSummary],
  );
  const skillStaminaCost = useMemo(
    () => resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('stamina') ? sum + entry.amount : sum, 0),
    [resourceSummary],
  );
  const totalStaminaLoad = estimatedCost + skillStaminaCost;
  const selectedEnemy = props.enemies.find((enemy) => enemy.id === props.selectedTargetId) ?? null;
  const modeLabel = props.actionType === ActionType.Defend
    ? 'Защитная стойка'
    : props.actionType === ActionType.Wait
      ? 'Ожидание'
      : props.selectedSkillId
        ? 'Навык подготовлен'
        : 'Базовая атака готова';

  return (
    <div className="action-planner compact-planner inner-card battle-command-deck">
      <div className="battle-command-head">
        <div>
          <h3>Боевой пульт</h3>
          <p>{modeLabel}</p>
        </div>
        <div className="battle-command-actions" role="group" aria-label="Боевой режим">
          <button
            type="button"
            className={props.actionType === ActionType.Attack ? 'is-active' : ''}
            onClick={() => props.onActionTypeChange(ActionType.Attack)}
          >
            Бой
          </button>
          <button
            type="button"
            className={props.actionType === ActionType.Defend ? 'is-active' : ''}
            onClick={() => props.onActionTypeChange(ActionType.Defend)}
          >
            Защита
          </button>
          <button
            type="button"
            className={props.actionType === ActionType.Wait ? 'is-active' : ''}
            onClick={() => props.onActionTypeChange(ActionType.Wait)}
          >
            Пауза
          </button>
        </div>
      </div>

      <section className="battle-target-strip" aria-label="Цели">
        <div className="battle-target-strip-head">
          <strong>Цели</strong>
          <span>ЛКМ или RMB на карте тоже меняют цель</span>
        </div>
        <div className="battle-target-chip-grid">
          {props.enemies.map((enemy) => (
            <button
              key={enemy.id}
              type="button"
              className={`battle-target-chip ${enemy.id === props.selectedTargetId ? 'is-active' : ''}`}
              onClick={() => props.onTargetChange(enemy.id)}
            >
              <span>{enemy.name}</span>
              <small>{enemy.currentHp}/{enemy.maxHp} HP</small>
            </button>
          ))}
        </div>
      </section>

      <section className="battle-quickbar" aria-label="Боевые быстрые слоты">
        <div className="battle-quickbar-head">
          <strong>Боевые слоты</strong>
          <span>Основной способ выбора атаки, клавиши 1-0</span>
        </div>
        <div className="battle-quickbar-grid">
          <button
            type="button"
            className={`battle-quickbar-slot battle-quickbar-basic ${props.selectedSkillId ? '' : 'is-active'}`}
            onClick={() => {
              props.onSkillChange(null);
              props.onActionTypeChange(ActionType.Attack);
            }}
            title="Базовая атака"
          >
            <span className="battle-quickbar-key">LMB</span>
            <span className="battle-quickbar-name">Базовая атака</span>
          </button>

          {skillOptions.map((skill) => (
            <button
              key={skill.slotId}
              type="button"
              className={`battle-quickbar-slot ${props.selectedSkillId === skill.skillId ? 'is-active' : ''}`}
              onClick={() => {
                props.onSkillChange(skill.skillId);
                props.onActionTypeChange(ActionType.Attack);
              }}
              title={`${formatQuickSlotLabel(skill.slotId)}: ${skill.label}`}
            >
              <span className="battle-quickbar-key">{formatQuickSlotLabel(skill.slotId)}</span>
              <span className="battle-quickbar-name">{skill.label}</span>
              <span className="battle-quickbar-meta">lvl {skill.level}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="battle-skill-focus" aria-label="Фокус действия">
        <div className="battle-skill-focus-copy">
          <strong>{selectedSkill?.label ?? 'Базовая атака'}</strong>
          <span>{selectedEnemy ? `Цель: ${selectedEnemy.name}` : 'Цель не выбрана'}</span>
        </div>
        <div className="battle-skill-focus-metrics">
          <span>MP {manaCost}</span>
          <span>STA {skillStaminaCost + ACTION_COSTS[props.actionType]}</span>
          <span>Move {props.movementType ? MOVEMENT_COSTS[props.movementType] : 0}</span>
          {selectedSkill ? <span>Lvl {selectedSkill.level}</span> : <span>LMB</span>}
        </div>
      </section>

      <div className="planner-status-rows">
        <div className="planner-status-row"><span>Дистанция:</span><strong>{DISTANCE_LABELS[props.currentDistance]}</strong></div>
        <div className="planner-status-row"><span>Защита:</span><strong>{getGuardLabel(props.defenseZones)}</strong></div>
        <div className="planner-status-row"><span>STA Load:</span><strong>{totalStaminaLoad}</strong></div>
        <div className="planner-status-row"><span>STA:</span><strong>{props.currentStamina} / {props.maxStamina}</strong></div>
        <div className="planner-status-row"><span>MP:</span><strong>{props.currentMp} / {props.maxMp}</strong></div>
        {props.movementType ? <div className="planner-status-row"><span>Движение:</span><strong>{MOVEMENT_LABELS[props.movementType]}{props.selectedMoveTile ? ` → ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : ''}</strong></div> : null}
      </div>

      <div className="planner-targeting-layout compact-zones">
        <BodyTargetSelector
          mode="attack"
          maxSelections={1}
          selectedZones={[props.attackZone]}
          onChange={(zones) => zones[0] && props.onAttackZoneChange(zones[0])}
          disabled={props.actionType !== ActionType.Attack}
          title="Зона атаки"
          recentHitZone={props.recentHitZone}
        />

        <div>
          <div className="battle-defense-utilities">
            <button type="button" className="secondary-button" onClick={() => props.onDefenseZonesChange([])}>
              Сбросить защиту
            </button>
            <button type="button" className={props.actionType === ActionType.Defend ? 'secondary-button is-active' : 'secondary-button'} onClick={() => props.onActionTypeChange(ActionType.Defend)}>
              Встать в защиту
            </button>
          </div>
          <BodyTargetSelector
            mode="defense"
            maxSelections={2}
            selectedZones={selectedDefenseZones}
            onChange={(zones) => props.onDefenseZonesChange(zones)}
            disabled={false}
            title="Зоны защиты"
            recentBlockedZone={props.recentBlockedZone}
          />
        </div>
      </div>

      {props.actionWarning ? <div className="battle-detail-popover"><p>{props.actionWarning}</p></div> : null}

      <section className="battle-consumables" aria-label="Боевые предметы">
        <div className="battle-consumables-head">
          <strong>Боевые предметы</strong>
          <span>Доступные из action slots</span>
        </div>
        {props.inventoryItems.length > 0 ? (
          <div className="battle-consumables-grid">
            {props.inventoryItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`battle-consumable-card ${selectedInventoryItem === item.id ? 'is-active' : ''}`}
                onClick={() => setSelectedInventoryItem(item.id)}
                title={`${item.name} x${item.quantity}${item.disabledReason ? ` — ${item.disabledReason}` : ''}`}
              >
                <span className="battle-consumable-name">{item.name}</span>
                <span className="battle-consumable-meta">x{item.quantity}</span>
                {item.costSummary ? <small>{item.costSummary}</small> : <small>Без стоимости</small>}
              </button>
            ))}
          </div>
        ) : (
          <div className="battle-detail-popover">
            <p>Боевые предметы не назначены.</p>
          </div>
        )}

        <div className="battle-detail-popover battle-consumable-detail">
          {selectedInventoryEntry ? (
            <>
              <strong>{selectedInventoryEntry.name}</strong>
              <p>{selectedInventoryEntry.description}</p>
              <p>Тип: {selectedInventoryEntry.itemType}</p>
              <p>Количество: {selectedInventoryEntry.quantity}</p>
              {selectedInventoryEntry.effectSummary ? <p>Эффект: {selectedInventoryEntry.effectSummary}</p> : null}
              {selectedInventoryEntry.costSummary ? <p>Стоимость: {selectedInventoryEntry.costSummary}</p> : null}
              <button
                type="button"
                className="secondary-button"
                disabled={!props.onUseInventoryItem || selectedInventoryEntry.disabled}
                onClick={() => {
                  if (props.onUseInventoryItem && !selectedInventoryEntry.disabled) {
                    void props.onUseInventoryItem(selectedInventoryEntry.id);
                  }
                }}
              >
                {selectedInventoryEntry.disabled ? (selectedInventoryEntry.disabledReason ?? 'Недоступно') : 'Использовать'}
              </button>
            </>
          ) : (
            <p>Выберите предмет, чтобы просмотреть и применить его.</p>
          )}
        </div>
      </section>

      {props.showSubmitButton !== false && (
        <button className="confirm-turn-button" disabled={props.disabled} onClick={props.onSubmit}>
          СДЕЛАТЬ ХОД
        </button>
      )}
    </div>
  );
}
