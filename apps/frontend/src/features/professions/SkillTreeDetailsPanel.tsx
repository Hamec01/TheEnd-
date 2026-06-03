import type { ProfessionBranch, ProfessionSkill, ProfessionSkillEffect } from '../../types/profession';

type NodeType = 'skill' | 'branch';

interface BaseSelectedNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon?: string;
  iconFrame?: {
    src: string;
    frameX: number;
    frameY: number;
    frameWidth: number;
    frameHeight: number;
    sheetWidth: number;
    sheetHeight: number;
  };
  blockedReason?: string;
  missingRequirements: string[];
}

export interface SelectedSkillNode extends BaseSelectedNode {
  type: 'skill';
  item: ProfessionSkill;
  canAct: boolean;
  actionLabel: string;
}

export interface SelectedBranchNode extends BaseSelectedNode {
  type: 'branch';
  item: ProfessionBranch;
  canAct: boolean;
  actionLabel: string;
}

export type SelectedTreeNode = SelectedSkillNode | SelectedBranchNode;

interface SkillTreeDetailsPanelProps {
  selected: SelectedTreeNode | null;
  onAction: (selected: SelectedTreeNode) => void;
  onClose?: () => void;
}

const EFFECT_LABELS_RU: Record<string, string> = {
  unlock_forge_action: 'Открывает действие кузни',
  unlock_temporary_buff: 'Открывает временный эффект',
  upgrade_temporary_buff: 'Усиливает временный эффект',
  unlock_special_recipe: 'Открывает особый рецепт',
  unlock_special_craft: 'Открывает особое ремесло',
  failure_chance_reduction: 'Снижение шанса неудачи',
  insert_stability_bonus: 'Бонус стабильности вставки',
  socket_preparation_success_bonus: 'Бонус успеха подготовки гнезда',
  max_defense_socket_unlock: 'Дополнительное защитное гнездо',
  max_weapon_socket_unlock: 'Дополнительное оружейное гнездо',
  max_socket_unlock: 'Дополнительное гнездо',
};

const EFFECT_TOKEN_RU: Record<string, string> = {
  unlock: 'открывает',
  upgrade: 'усиливает',
  temporary: 'временный',
  buff: 'эффект',
  forge: 'кузню',
  action: 'действие',
  max: 'макс',
  defense: 'защиты',
  weapon: 'оружия',
  socket: 'гнездо',
  sockets: 'гнезда',
  preparation: 'подготовки',
  success: 'успеха',
  bonus: 'бонус',
  insert: 'вставки',
  stability: 'стабильности',
  failure: 'неудачи',
  chance: 'шанса',
  reduction: 'снижение',
  mine: 'шахта',
  mining: 'добыча',
  depth: 'глубина',
  hit: 'удар',
  hits: 'удары',
  hazard: 'опасность',
  event: 'событие',
  block: 'блок',
  loot: 'добыча',
  rarity: 'редкость',
  modifier: 'модификатор',
};

const ITEM_GROUP_LABELS_RU: Record<string, string> = {
  weapon: 'оружию',
  armor: 'броне',
  shield: 'щитам',
  sword: 'мечам',
  dagger: 'кинжалам',
  axe: 'топорам',
  spear: 'копьям',
  hammer: 'молотам',
  two_handed_weapon: 'двуручному оружию',
  heavy_armor: 'тяжелой броне',
  helmet: 'шлемам',
  jewelry: 'украшениям',
  ring: 'кольцам',
  amulet: 'амулетам',
  jewelry_base: 'основам украшений',
  socket_base: 'основам гнезд',
};

const STAT_LABELS_RU: Record<string, string> = {
  armor: 'броне',
  endurance: 'выносливости тела',
  stamina: 'запасу сил',
  agility: 'ловкости',
  hit_chance: 'шансу попадания',
  crit_chance: 'шансу критического удара',
  armor_penetration: 'пробитию брони',
  blunt_damage: 'дробящему урону',
  slash_damage: 'режущему урону',
  block_chance: 'шансу блока',
  stamina_cost_modifier: 'расходу выносливости',
  incoming_blunt_damage_modifier: 'входящему дробящему урону',
  status_resistance_stunned: 'сопротивлению оглушению',
  status_resistance_concussed: 'сопротивлению контузии',
};

const BUFF_ID_LABELS_RU: Record<string, string> = {
  reinforced_plates: 'Усиленные пластины',
  weapon_balance: 'Равновесие оружия',
  sharp_edge: 'Острая кромка',
  combat_grip: 'Боевой хват',
  heavy_impact: 'Тяжелый удар',
  personal_weapon_fit: 'Личная подгонка оружия',
  shield_brace: 'Щитовой упор',
  armor_fitting: 'Подгонка брони',
  dampening_layer: 'Гасительный слой',
  iron_stance: 'Железная стойка',
  anti_stun_assembly: 'Противоударная сборка',
  simple_tempering: 'Простая закалка',
};

const FORGE_ACTION_LABELS_RU: Record<string, string> = {
  add_weapon_socket: 'Открывает кузнечное действие: добавить оружейное гнездо.',
  add_second_weapon_socket: 'Открывает кузнечное действие: добавить второе оружейное гнездо.',
  add_defense_socket: 'Открывает кузнечное действие: добавить защитное гнездо.',
  add_second_defense_socket: 'Открывает кузнечное действие: добавить второе защитное гнездо.',
  create_metal_setting: 'Открывает кузнечное действие: создать металлическую оправу.',
};

const RECIPE_GROUP_LABELS_RU: Record<string, string> = {
  basic_weapons: 'базовое оружие',
  basic_armor: 'базовую броню',
  basic_settings: 'базовые оправы',
  advanced_gem_settings: 'продвинутые ювелирные оправы',
};

function toRuEffectLabel(type: string): string {
  if (!type) {
    return 'Эффект';
  }
  const direct = EFFECT_LABELS_RU[type];
  if (direct) {
    return direct;
  }

  const words = type
    .split('_')
    .filter(Boolean)
    .map((token) => EFFECT_TOKEN_RU[token.toLowerCase()] ?? token);

  if (words.length === 0) {
    return type;
  }

  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toRuWords(value: string): string {
  const tokens = value
    .split('_')
    .filter(Boolean)
    .map((token) => EFFECT_TOKEN_RU[token.toLowerCase()] ?? token.toLowerCase());
  if (tokens.length === 0) {
    return value;
  }
  const phrase = tokens.join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function toRuBuffName(buffId: string): string {
  return BUFF_ID_LABELS_RU[buffId] ?? toRuWords(buffId);
}

function toRuItemGroupList(groups: unknown): string | null {
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }
  const names = groups
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => ITEM_GROUP_LABELS_RU[entry] ?? toRuWords(entry));
  return names.length > 0 ? names.join(', ') : null;
}

function toRuStatLabel(stat: string): string {
  return STAT_LABELS_RU[stat] ?? toRuWords(stat);
}

function toValueText(value: unknown, valueType: unknown): string {
  if (typeof value !== 'number') {
    return '—';
  }
  const signed = value > 0 ? `+${value}` : `${value}`;
  return valueType === 'percent' ? `${signed}%` : signed;
}

function formatEffectLoreLines(effect: ProfessionSkillEffect): string[] {
  const lines: string[] = [];
  const params = effect.params && typeof effect.params === 'object' ? effect.params as Record<string, unknown> : null;

  if (effect.type === 'unlock_temporary_buff' || effect.type === 'upgrade_temporary_buff') {
    const buffId = params?.buffId;
    if (typeof buffId === 'string' && buffId.trim().length > 0) {
      lines.push(`Клеймо кузни: «${toRuBuffName(buffId)}».`);
    }

    const duration = params?.durationHours ?? params?.temporaryBuffDurationHours;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      lines.push(`Длительность благословения: ${duration} ч.`);
    }

    const itemGroups = toRuItemGroupList(params?.allowedItemGroups);
    if (itemGroups) {
      lines.push(`Действует по металлу: ${itemGroups}.`);
    }

    const buffEntries = Array.isArray(params?.temporaryItemBuff)
      ? params.temporaryItemBuff
      : Array.isArray(params?.temporaryItemBuffBonus)
        ? params.temporaryItemBuffBonus
        : [];
    for (const entry of buffEntries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const stat = (entry as Record<string, unknown>).stat;
      if (typeof stat !== 'string' || stat.trim().length === 0) {
        continue;
      }
      const value = (entry as Record<string, unknown>).value;
      const valueType = (entry as Record<string, unknown>).valueType;
      lines.push(`${toValueText(value, valueType)} к ${toRuStatLabel(stat)}.`);
    }

    if (lines.length > 0) {
      return lines;
    }
  }

  if (effect.type === 'unlock_forge_action' && params) {
    const action = params.action;
    if (typeof action === 'string' && action.trim().length > 0) {
      lines.push(FORGE_ACTION_LABELS_RU[action] ?? `Открывает кузнечное действие: ${toRuWords(action)}.`);
    }
    const itemGroups = toRuItemGroupList(params.allowedItemGroups);
    if (itemGroups) {
      lines.push(`Доступно для: ${itemGroups}.`);
    }
    if (lines.length > 0) {
      return lines;
    }
  }

  if (effect.type === 'unlock_recipe_group' && params) {
    const group = params.group;
    if (typeof group === 'string' && group.trim().length > 0) {
      lines.push(`Открывает путь ремесла: ${RECIPE_GROUP_LABELS_RU[group] ?? toRuWords(group)}.`);
    }
    const itemGroups = toRuItemGroupList(params.allowedItemGroups);
    if (itemGroups) {
      lines.push(`Применимо к: ${itemGroups}.`);
    }
    if (lines.length > 0) {
      return lines;
    }
  }

  lines.push(`${toRuEffectLabel(effect.type)}: ${effect.value ?? '—'}`);
  return lines;
}

export function SkillTreeDetailsPanel(props: SkillTreeDetailsPanelProps) {
  const { selected, onAction, onClose } = props;

  if (!selected) {
    return null;
  }

  const effects = selected.type === 'skill' ? (selected.item.effects ?? []) : [];
  const requirements = selected.missingRequirements;

  return (
    <section
      className="inner-card"
      style={{
        minHeight: 150,
        display: 'grid',
        gap: 8,
        borderRadius: 12,
        border: '1px solid rgba(178, 138, 75, 0.34)',
        background: 'linear-gradient(180deg, rgba(22, 17, 12, 0.94), rgba(11, 9, 7, 0.96))',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.32), inset 0 0 0 1px rgba(81, 59, 35, 0.42)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid rgba(198, 161, 106, 0.58)',
            background: 'rgba(13, 11, 8, 0.9)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(88, 63, 36, 0.66)',
          }}
        >
          {selected.iconFrame?.src ? (
            <span
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${selected.iconFrame.src})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: `-${selected.iconFrame.frameX * (96 / Math.max(1, selected.iconFrame.frameWidth))}px -${selected.iconFrame.frameY * (96 / Math.max(1, selected.iconFrame.frameHeight))}px`,
                backgroundSize: `${selected.iconFrame.sheetWidth * (96 / Math.max(1, selected.iconFrame.frameWidth))}px ${selected.iconFrame.sheetHeight * (96 / Math.max(1, selected.iconFrame.frameHeight))}px`,
                imageRendering: 'pixelated',
              }}
            />
          ) : selected.icon ? (
            <img src={selected.icon} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 20 }}>{selected.type === 'branch' ? '⚚' : '✦'}</span>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ display: 'block', fontSize: 22, letterSpacing: 0.4, color: '#f0dfc0' }}>{selected.name}</strong>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(174, 129, 70, 0.52)',
                  background: 'rgba(22, 16, 11, 0.85)',
                  color: '#dbc49a',
                  padding: '4px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <p className="wm-stat-hint" style={{ marginTop: 6, marginBottom: 0, color: 'rgba(214, 196, 162, 0.85)' }}>
            {selected.type === 'branch' ? 'Ветка специализации' : 'Базовый навык'}
          </p>
          <p className="wm-stat-hint" style={{ marginTop: 8 }}>{selected.description || 'Описание отсутствует.'}</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 168px',
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            borderRadius: 8,
            border: '1px solid rgba(129, 94, 51, 0.48)',
            background: 'rgba(16, 13, 10, 0.9)',
            padding: 10,
          }}
        >
          <strong style={{ fontSize: 13, color: '#c9a971', display: 'block', marginBottom: 8 }}>Требования</strong>
          {selected.type === 'skill' ? (
            <p className="wm-stat-hint" style={{ margin: '0 0 8px 0' }}>
              Уровень профессии: {selected.item.requiredLevel}
            </p>
          ) : null}
          {requirements.length > 0 ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {requirements.map((entry) => (
                <p key={entry} className="wm-stat-hint" style={{ margin: 0 }}>{entry}</p>
              ))}
            </div>
          ) : (
            <p className="wm-stat-hint" style={{ margin: 0 }}>Все требования выполнены.</p>
          )}
        </div>

        <div
          style={{
            borderRadius: 8,
            border: '1px solid rgba(129, 94, 51, 0.48)',
            background: 'rgba(16, 13, 10, 0.9)',
            padding: 10,
          }}
        >
          <strong style={{ fontSize: 13, color: '#c9a971', display: 'block', marginBottom: 8 }}>Эффекты</strong>
          {effects.length > 0 ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {effects.map((effect, index) => (
                <div key={`${selected.id}-${effect.id ?? index}`} style={{ display: 'grid', gap: 2 }}>
                  {formatEffectLoreLines(effect).map((line, lineIndex) => (
                    <p key={`${selected.id}-${effect.id ?? index}-${lineIndex}`} className="wm-stat-hint" style={{ margin: 0 }}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="wm-stat-hint" style={{ margin: 0 }}>Нет прямых эффектов.</p>
          )}
        </div>

        <div
          style={{
            borderRadius: 8,
            border: '1px solid rgba(162, 121, 64, 0.6)',
            background: 'linear-gradient(180deg, rgba(26, 19, 12, 0.95), rgba(14, 11, 8, 0.95))',
            padding: 10,
            display: 'grid',
            alignContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <strong style={{ fontSize: 13, color: '#c9a971', display: 'block', marginBottom: 6 }}>Стоимость</strong>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f2dfba' }}>
              {selected.type === 'skill' ? selected.item.skillPointCost : 0}
            </p>
          </div>
          <button
            type="button"
            disabled={!selected.canAct}
            onClick={() => onAction(selected)}
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid rgba(214, 162, 79, 0.68)',
              background: selected.canAct
                ? 'linear-gradient(180deg, rgba(154, 112, 48, 0.98), rgba(108, 77, 33, 0.98))'
                : 'linear-gradient(180deg, rgba(65, 56, 43, 0.8), rgba(45, 38, 28, 0.8))',
              color: selected.canAct ? '#f5e8cc' : 'rgba(208, 196, 173, 0.62)',
              fontWeight: 700,
              padding: '10px 12px',
              cursor: selected.canAct ? 'pointer' : 'not-allowed',
            }}
          >
            {selected.actionLabel}
          </button>
          <p className="wm-stat-hint" style={{ margin: 0 }}>
            Доступно очков навыков зависит от уровня профессии.
          </p>
        </div>
      </div>

      {selected.blockedReason ? (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid rgba(146, 82, 82, 0.4)',
            background: 'rgba(50, 25, 25, 0.42)',
            padding: 8,
          }}
        >
          <p className="wm-stat-hint" style={{ margin: 0 }}>{selected.blockedReason}</p>
        </div>
      ) : null}

      {requirements.length > 0 ? (
        <details>
          <summary className="wm-stat-hint" style={{ cursor: 'pointer' }}>Подробности требований</summary>
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {requirements.map((entry) => (
              <p key={entry} className="wm-stat-hint" style={{ margin: 0 }}>{entry}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
