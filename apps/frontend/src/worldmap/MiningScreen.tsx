import React from 'react';
import { MiningPhaserRenderer } from '../features/mining/MiningPhaserRenderer';
import type { MineDefinition, MineDepth, MineRunState } from '../types/mining';
import { fixMojibake } from '../utils/fixMojibake';

export interface MiningScreenProps {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  miningLevel: number;
  pickaxeName?: string | null;
  emergencyEscapeAvailable?: boolean;
  resolveItemName: (itemId: string) => string;
  onHitBlock: (blockIndex: number) => void;
  onEscape: () => void;
  onRetreat: () => void;
  onDescend: () => void;
  onFinalize: () => void;
  onClose: () => void;
}

function dangerLabel(depthLevel: number): string {
  if (depthLevel >= 3) {
    return 'Высокая опасность';
  }
  if (depthLevel === 2) {
    return 'Средняя опасность';
  }
  return 'Низкая опасность';
}

function buildVisibleSlots(run: MineRunState, resolveItemName: (itemId: string) => string) {
  const derivedSlots = run.temporaryLoot.map((entry, index) => ({
    slotIndex: index,
    itemId: entry.itemId,
    name: fixMojibake(resolveItemName(entry.itemId)),
    quantity: entry.quantity,
  }));
  const maxSlots = run.temporaryLootSlots?.maxSlots ?? 10;
  const slots = run.temporaryLootSlots?.slots?.length
    ? run.temporaryLootSlots.slots.map((entry) => ({
      ...entry,
      name: entry.itemId ? fixMojibake(resolveItemName(entry.itemId)) : entry.name,
    }))
    : derivedSlots;
  return {
    maxSlots,
    slots,
  };
}

function renderLootSummary(loot: MineRunState['temporaryLoot'], resolveItemName: (itemId: string) => string) {
  if (loot.length === 0) {
    return <p className="mining-muted">Пока пусто.</p>;
  }
  return loot.map((entry) => (
    <p key={`${entry.itemId}-${entry.quantity}`} className="mining-row">
      <span>{fixMojibake(resolveItemName(entry.itemId))}</span>
      <strong>x{entry.quantity}</strong>
    </p>
  ));
}

export function MiningScreen({
  mine,
  depth,
  run,
  miningLevel,
  pickaxeName,
  emergencyEscapeAvailable = false,
  resolveItemName,
  onHitBlock,
  onEscape,
  onRetreat,
  onDescend,
  onFinalize,
  onClose,
}: MiningScreenProps) {
  const canEscape = run.status === 'active' && run.foundExit;
  const canDescend = run.status === 'active' && run.foundPassage;
  const canRetreat = run.status === 'active';
  const visibleSlots = buildVisibleSlots(run, resolveItemName);

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card mining-window wm-modal">
        <div className="battle-window-head">
          <h2>Горняк / Горянка</h2>
          <button onClick={onClose}>x</button>
        </div>

        <div className="mining-layout">
          <aside className="mining-panel">
            <h3>{fixMojibake(mine.name)}</h3>
            <p className="mining-muted">{fixMojibake(depth.name)} | глубина {depth.depthLevel}</p>
            <div className="mining-stat-list">
              <p className="mining-row"><span>Уровень Горняка</span><strong>{miningLevel}</strong></p>
              <p className="mining-row"><span>HP</span><strong>{run.hp} / {run.maxHp}</strong></p>
              <p className="mining-row"><span>Выносливость</span><strong>{run.stamina} / {run.maxStamina}</strong></p>
              <p className="mining-row"><span>Осталось ударов</span><strong>{run.remainingHits}</strong></p>
              <p className="mining-row"><span>Риск обвала</span><strong>{Math.round(run.collapseRisk * 100)}%</strong></p>
              <p className="mining-row"><span>Кирка</span><strong>{fixMojibake(pickaxeName || 'Безымянная кирка')}</strong></p>
              <p className="mining-row"><span>Слоты добычи</span><strong>{visibleSlots.slots.length} / {visibleSlots.maxSlots}</strong></p>
              <p className="mining-row"><span>Опасность</span><strong>{dangerLabel(depth.depthLevel)}</strong></p>
            </div>
            {mine.entryText ? <p className="mining-muted">{fixMojibake(mine.entryText)}</p> : null}
            {emergencyEscapeAvailable ? <p className="mining-muted">Аварийный выход доступен навыком.</p> : null}
          </aside>

          <main className="mining-center">
            <MiningPhaserRenderer
              mine={mine}
              depth={depth}
              run={run}
              disabled={run.status !== 'active'}
              onHitBlock={onHitBlock}
            />
          </main>

          <aside className="mining-panel mining-side-tabs">
            <div className="mining-side-section">
              <h3>Добыча</h3>
              <div className="mining-loot-list">
                {visibleSlots.slots.length === 0 ? <p className="mining-muted">Пока пусто.</p> : null}
                {visibleSlots.slots.map((entry) => (
                  <p key={`${entry.itemId ?? entry.slotIndex}`} className="mining-row">
                    <span>{fixMojibake(entry.name)}</span>
                    <strong>x{entry.quantity}</strong>
                  </p>
                ))}
                <p className="mining-row mining-gold-row"><span>Золото</span><strong>{run.temporaryGold}</strong></p>
              </div>
            </div>

            <div className="mining-side-section">
              <h3>Инвентарь</h3>
              <div className="mining-loot-list">
                {(run.miningInventory ?? []).length === 0 ? <p className="mining-muted">Пока только базовая кирка.</p> : null}
                {(run.miningInventory ?? []).map((entry) => (
                  <p key={entry.toolId} className="mining-row">
                    <span>{fixMojibake(entry.name)}</span>
                    <strong>x{entry.quantity}</strong>
                  </p>
                ))}
              </div>
            </div>

            {run.status !== 'active' && run.resultSummary ? (
              <div className="mining-result-summary">
                <h3>Итог</h3>
                <p className="mining-muted">
                  {run.status === 'escaped' ? 'Спуск завершён безопасным выходом.' : null}
                  {run.status === 'retreated' ? 'Вы отступили и потеряли часть добычи.' : null}
                  {run.status === 'dead' ? 'Шахта оказалась сильнее вас.' : null}
                  {run.status === 'failed' ? 'Спуск провален.' : null}
                </p>
                <div className="mining-loot-list">
                  <p className="mining-row"><span>Добыча</span><strong>{run.resultSummary.totalLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Сохранено</span><strong>{run.resultSummary.savedLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Потеряно</span><strong>{run.resultSummary.lostLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Золото</span><strong>+{run.resultSummary.goldAwarded}</strong></p>
                  <p className="mining-row"><span>Опыт Горняка</span><strong>+{run.resultSummary.xpAwarded}</strong></p>
                </div>
                <div className="mining-result-details">
                  <h4>Сохранено</h4>
                  {renderLootSummary(run.resultSummary.savedLoot, resolveItemName)}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mining-log">
          {run.eventLog.slice(-30).map((entry, index) => (
            <p key={`${run.runId}-log-${index}`}>{fixMojibake(entry)}</p>
          ))}
        </div>

        <div className="mining-actions">
          {run.status === 'active' ? (
            <>
              <button disabled={!canRetreat} onClick={onRetreat}>Отступить</button>
              <button disabled={!canEscape} onClick={onEscape}>Выйти</button>
              <button disabled={!canDescend} onClick={onDescend}>Спуститься глубже</button>
            </>
          ) : (
            <>
              <button onClick={onFinalize}>Подтвердить результат</button>
              <button onClick={onClose}>Покинуть шахту</button>
            </>
          )}
        </div>

        <style>{`
          .mining-window {
            width: min(1500px, 96vw);
            height: min(900px, 92vh);
            max-width: 96vw;
            max-height: 92vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            gap: 1rem;
            background: linear-gradient(180deg, rgba(18, 14, 11, 0.98), rgba(10, 8, 7, 0.99));
          }
          .mining-layout {
            flex: 1;
            min-height: 0;
            display: grid;
            grid-template-columns: 260px minmax(640px, 1fr) 280px;
            gap: 1rem;
            align-items: stretch;
            overflow: hidden;
          }
          .mining-panel {
            min-height: 0;
            overflow: auto;
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(27, 22, 18, 0.95);
            padding: 0.9rem;
            border-radius: 8px;
          }
          .mining-panel h3 {
            margin: 0 0 0.5rem 0;
          }
          .mining-side-tabs {
            display: grid;
            gap: 0.9rem;
          }
          .mining-side-section {
            display: grid;
            gap: 0.45rem;
            align-content: start;
          }
          .mining-center {
            min-width: 0;
            min-height: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            border-radius: 10px;
            background: radial-gradient(circle at top, rgba(72, 50, 34, 0.24), rgba(16, 11, 8, 0.92));
            border: 1px solid rgba(164, 141, 110, 0.2);
          }
          .mining-stat-list,
          .mining-loot-list,
          .mining-result-details {
            display: grid;
            gap: 0.45rem;
          }
          .mining-row {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            margin: 0;
          }
          .mining-muted {
            color: #c7b69c;
            margin: 0;
          }
          .mining-gold-row {
            padding-top: 0.5rem;
            border-top: 1px solid rgba(164, 141, 110, 0.16);
          }
          .mining-log {
            flex: 0 0 auto;
            height: 160px;
            min-height: 140px;
            overflow-y: auto;
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(18, 15, 13, 0.98);
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.35;
          }
          .mining-log p {
            margin: 0 0 0.4rem 0;
          }
          .mining-actions {
            flex: 0 0 auto;
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
            flex-wrap: wrap;
            padding-top: 10px;
          }
          @media (max-width: 1100px) {
            .mining-window {
              width: 98vw;
              height: 94vh;
              max-width: 98vw;
              max-height: 94vh;
            }
            .mining-layout {
              grid-template-columns: 1fr;
              overflow-y: auto;
              overflow-x: hidden;
            }
            .mining-center {
              min-height: 460px;
            }
          }
        `}</style>
      </section>
    </div>
  );
}
