import type { MapNodeData, ContextMode } from './types';

interface ContextActionPanelProps {
  mode: ContextMode;
  selectedNode: MapNodeData | null;
  onAction: (actionId: string, kind: string) => void;
}

export function ContextActionPanel(props: ContextActionPanelProps) {
  const { mode, selectedNode, onAction } = props;

  const recentEvents = [
    'Вы получили 120 опыта',
    'Добавлен предмет: Кожа волка',
    'Потрачено: 15 золота',
    'Вы вошли в локацию: Арклейн',
    'Бой начался',
  ];

  const quests = [
    'Гибель каравана',
    'Доставка в Брейнхольд',
    'Охота на волков',
  ];

  if (!selectedNode || mode === 'empty') {
    return (
      <aside className="wm-context card">
        <section className="wm-context-block">
          <h3>Задания</h3>
          {quests.map((quest) => (
            <p key={quest}>{quest}</p>
          ))}
        </section>
        <section className="wm-context-block">
          <h3>Последние события</h3>
          {recentEvents.map((event) => (
            <p key={event} className="muted">+ {event}</p>
          ))}
        </section>
        <p className="muted">Выберите точку на карте, чтобы открыть действия.</p>
      </aside>
    );
  }

  if (mode === 'combat') {
    return (
      <aside className="wm-context card">
        <h3>Ambush on the Road</h3>
        <p className="muted">A hostile group blocks your path near {selectedNode.name}.</p>
        <div className="wm-action-grid">
          <button onClick={() => onAction('enter-battle', 'combat')}>Enter Battle</button>
          <button onClick={() => onAction('scout-enemy', 'scout')}>Scout Enemy</button>
          <button onClick={() => onAction('retreat', 'rest')}>Retreat</button>
        </div>
      </aside>
    );
  }

  if (mode === 'npc') {
    return (
      <aside className="wm-context card">
        <h3>NPC Message</h3>
        <p className="muted">A guard blocks your way in {selectedNode.name}. Choose your response.</p>
        <div className="wm-action-grid">
          <button onClick={() => onAction('talk', 'talk')}>Talk</button>
          <button onClick={() => onAction('trade', 'trade')}>Trade</button>
          <button onClick={() => onAction('attack', 'combat')}>Attack</button>
          <button onClick={() => onAction('leave', 'rest')}>Leave</button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="wm-context card">
      <section className="wm-context-block">
        <h3>{selectedNode.name}</h3>
        <p className="wm-meta-row">
          <span>{selectedNode.type}</span>
          <span>{selectedNode.faction}</span>
        </p>
        <p className="wm-meta-row">
          <span>Danger: {selectedNode.danger}</span>
          <span>Lvl {selectedNode.recommendedLevel}</span>
          <span>{selectedNode.access}</span>
        </p>
        <p className="muted">{selectedNode.description}</p>

        <div className="wm-action-grid">
          {selectedNode.actions.map((action) => (
            <button key={action.id} onClick={() => onAction(action.id, action.kind)}>
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="wm-context-block">
        <h3>Последние события</h3>
        {recentEvents.slice(0, 3).map((event) => (
          <p key={event} className="muted">+ {event}</p>
        ))}
      </section>
    </aside>
  );
}
