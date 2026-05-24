import type { ProfessionBranch, ProfessionSkill } from '../../types/profession';

type NodeType = 'skill' | 'branch';

interface BaseSelectedNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon?: string;
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
}

export function SkillTreeDetailsPanel(props: SkillTreeDetailsPanelProps) {
  const { selected, onAction } = props;

  if (!selected) {
    return (
      <section className="inner-card" style={{ minHeight: 180 }}>
        <strong>Узел не выбран</strong>
        <p className="wm-stat-hint">Нажмите на навык или ветку, чтобы увидеть детали.</p>
      </section>
    );
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
          {selected.icon ? (
            <img src={selected.icon} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 20 }}>{selected.type === 'branch' ? '⚚' : '✦'}</span>
          )}
        </div>
        <div>
          <strong style={{ display: 'block', fontSize: 22, letterSpacing: 0.4, color: '#f0dfc0' }}>{selected.name}</strong>
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
                <p key={`${selected.id}-${effect.id ?? index}`} className="wm-stat-hint" style={{ margin: 0 }}>
                  {effect.type}: {effect.value ?? '—'}
                </p>
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
