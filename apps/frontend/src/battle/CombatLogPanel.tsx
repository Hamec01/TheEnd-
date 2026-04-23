import type { CombatLogEntry } from '@theend/rpg-domain';

interface CombatLogPanelProps {
  logs: CombatLogEntry[];
}

export function CombatLogPanel({ logs }: CombatLogPanelProps) {
  return (
    <div className="combat-log">
      <h3>Журнал боя</h3>
      <div className="combat-log-body">
        {logs.length === 0 ? <p>Событий пока нет.</p> : null}
        {logs.slice(-12).map((entry, index) => (
          <p key={`${entry.round}-${entry.actorId}-${index}`}>{entry.text}</p>
        ))}
      </div>
    </div>
  );
}
