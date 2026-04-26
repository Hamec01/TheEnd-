import type { CombatLogEntry } from '@theend/rpg-domain';
import { useEffect, useMemo, useRef } from 'react';

interface CombatLogPanelProps {
  logs: CombatLogEntry[];
}

export function CombatLogPanel({ logs }: CombatLogPanelProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const visibleLogs = useMemo(() => logs.slice(-40), [logs]);

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [visibleLogs]);

  function logClass(entry: CombatLogEntry): string {
    if (entry.type === 'HIT') {
      if (/critical/i.test(entry.text)) {
        return 'log-critical';
      }
      return 'log-damage';
    }
    if (entry.type === 'BLOCK') {
      return 'log-block';
    }
    if (entry.type === 'MISS') {
      return 'log-system';
    }
    if (entry.type === 'DEATH') {
      return 'log-enemy';
    }
    return 'log-player';
  }

  return (
    <div className="combat-log battle-log-panel">
      <h3>Журнал боя</h3>
      <div className="combat-log-body" ref={bodyRef}>
        {logs.length === 0 ? <p>Событий пока нет.</p> : null}
        {visibleLogs.map((entry, index) => (
          <p key={`${entry.round}-${entry.actorId}-${index}`} className={logClass(entry)}>
            <span className="combat-log-round">R{entry.round}</span> {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}
