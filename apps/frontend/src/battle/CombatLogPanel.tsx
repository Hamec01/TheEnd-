import type { CombatLogEntry } from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';

interface CombatLogPanelProps {
  logs: CombatLogEntry[];
}

export function CombatLogPanel({ logs }: CombatLogPanelProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const visibleLogs = useMemo(() => logs.slice(-40), [logs]);
  const latestEntry = visibleLogs.at(-1) ?? null;
  const tickerEntries = useMemo(() => visibleLogs.slice(-2).reverse(), [visibleLogs]);

  useEffect(() => {
    if (isCollapsed || !bodyRef.current) {
      return;
    }
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [isCollapsed, visibleLogs]);

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
      <div className="combat-log-header">
        <div className="combat-log-header-copy">
          <h3>Журнал боя</h3>
          <span className="combat-log-meta">{visibleLogs.length} записей</span>
        </div>
        <button type="button" className="combat-log-toggle" onClick={() => setIsCollapsed((current) => !current)}>
          {isCollapsed ? 'Развернуть' : 'Свернуть'}
        </button>
      </div>

      <div className="combat-log-ticker" aria-live="polite">
        {tickerEntries.length === 0 ? <span>Событий пока нет.</span> : null}
        {tickerEntries.map((entry, index) => (
          <span key={`${entry.round}-${entry.actorId}-${index}`} className={`combat-log-ticker-item ${logClass(entry)}`}>
            <strong>R{entry.round}</strong> {entry.text}
          </span>
        ))}
      </div>

      {isCollapsed ? (
        <div className="combat-log-collapsed">
          {latestEntry ? latestEntry.text : 'Событий пока нет.'}
        </div>
      ) : (
        <div className="combat-log-body" ref={bodyRef}>
          {logs.length === 0 ? <p>Событий пока нет.</p> : null}
          {visibleLogs.map((entry, index) => (
            <p key={`${entry.round}-${entry.actorId}-${index}`} className={logClass(entry)}>
              <span className="combat-log-round">R{entry.round}</span> {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
