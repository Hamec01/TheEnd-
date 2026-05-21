import React, { memo } from 'react';
import type { MineDefinition, MineDepth, MineRunState } from '../types/mining';
import { fixMojibake } from '../utils/fixMojibake';

interface MiningScreenProps {
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

interface MineBlockProps {
  block: MineRunState['blocks'][number];
  disabled: boolean;
  onHitBlock: (blockIndex: number) => void;
}

function blockText(block: MineRunState['blocks'][number]): string {
  if (block.state === 'closed') {
    return fixMojibake(block.label || '???');
  }
  return fixMojibake(block.label || block.visibleType || 'Открыто');
}

function renderLootList(
  loot: MineRunState['temporaryLoot'],
  resolveItemName: (itemId: string) => string,
): React.ReactNode {
  if (loot.length === 0) {
    return <p className="muted">Нет.</p>;
  }
  return loot.map((entry) => (
    <p key={`${entry.itemId}-${entry.quantity}`}>
      <span>{fixMojibake(resolveItemName(entry.itemId))}</span>
      <strong>x{entry.quantity}</strong>
    </p>
  ));
}

const MineBlock = memo(function MineBlock({ block, disabled, onHitBlock }: MineBlockProps) {
  const isClosed = block.state === 'closed';
  return (
    <button
      type="button"
      className={`mine-block ${isClosed ? 'is-closed' : 'is-opened'}`}
      disabled={disabled || !isClosed}
      onClick={() => onHitBlock(block.index)}
    >
      <span>{blockText(block)}</span>
      {block.loot?.length ? <small>{block.loot.map((entry) => `${entry.quantity}x`).join(' ')}</small> : null}
    </button>
  );
});

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
  const canEscape = run.status === 'active';
  const canDescend = run.status === 'active' && run.foundPassage;
  const canRetreat = run.status === 'active';

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card mining-window wm-modal">
        <div className="battle-window-head">
          <h2>Горняк / Горянка</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="mining-layout">
          <aside className="mining-panel">
            <h3>{fixMojibake(mine.name)}</h3>
            <p className="muted">{fixMojibake(depth.name)} | глубина {depth.depthLevel}</p>
            <div className="mining-stat-list">
              <p><span>Уровень Горняка</span><strong>{miningLevel}</strong></p>
              <p><span>HP</span><strong>{run.hp} / {run.maxHp}</strong></p>
              <p><span>Выносливость</span><strong>{run.stamina} / {run.maxStamina}</strong></p>
              <p><span>Осталось ударов</span><strong>{run.remainingHits}</strong></p>
              <p><span>Риск обвала</span><strong>{Math.round(run.collapseRisk * 100)}%</strong></p>
              <p><span>Кирка</span><strong>{fixMojibake(pickaxeName || 'Безымянная кирка')}</strong></p>
            </div>
            {mine.entryText ? <p className="muted">{fixMojibake(mine.entryText)}</p> : null}
            {emergencyEscapeAvailable ? <p className="muted">Аварийный выход доступен.</p> : null}
          </aside>

          <main className="mining-center">
            <div
              className="mining-grid"
              style={{ gridTemplateColumns: `repeat(${depth.columns}, minmax(0, 1fr))` }}
            >
              {run.blocks.map((block) => (
                <MineBlock
                  key={block.index}
                  block={block}
                  disabled={run.status !== 'active'}
                  onHitBlock={onHitBlock}
                />
              ))}
            </div>
          </main>

          <aside className="mining-panel">
            <h3>Временная добыча</h3>
            <div className="mining-loot-list">
              {run.temporaryLoot.length === 0 ? <p className="muted">Пока пусто.</p> : null}
              {run.temporaryLoot.map((entry) => (
                <p key={entry.itemId}>
                  <span>{fixMojibake(resolveItemName(entry.itemId))}</span>
                  <strong>x{entry.quantity}</strong>
                </p>
              ))}
            </div>
            {run.status !== 'active' && run.resultSummary ? (
              <div className="mining-result-summary">
                <h3>Итог</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {run.status === 'escaped' ? 'Вы выбрались из шахты.' : null}
                  {run.status === 'retreated' ? 'Вы отступили и потеряли часть добычи.' : null}
                  {run.status === 'dead' ? 'Вы потеряли сознание в шахте.' : null}
                  {run.status === 'failed' ? 'Забег в шахте провален.' : null}
                </p>
                <div className="mining-loot-list">
                  <p><span>Добыча (всего)</span><strong>{run.resultSummary.totalLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p><span>Сохранено</span><strong>{run.resultSummary.savedLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p><span>Потеряно</span><strong>{run.resultSummary.lostLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p><span>Спасено навыками</span><strong>{run.resultSummary.savedBySkills.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p><span>Спасено носильщиками</span><strong>{run.resultSummary.savedByPorters.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p><span>Золото</span><strong>+{run.resultSummary.goldAwarded}</strong></p>
                  {run.resultSummary.bonusGoldFromSellValue > 0 ? <p><span>Бонус от продажи</span><strong>+{run.resultSummary.bonusGoldFromSellValue}</strong></p> : null}
                  <p><span>Опыт Горняка</span><strong>+{run.resultSummary.xpAwarded}</strong></p>
                  {run.resultLevelUp ? <p><span>Новый уровень</span><strong>+1</strong></p> : null}
                </div>
                <div className="mining-result-details">
                  <h4>Сохранено</h4>
                  {renderLootList(run.resultSummary.savedLoot, resolveItemName)}
                  {run.resultSummary.savedBySkills.length > 0 ? (
                    <>
                      <h4>Спасено навыками</h4>
                      {renderLootList(run.resultSummary.savedBySkills, resolveItemName)}
                    </>
                  ) : null}
                  {run.resultSummary.savedByPorters.length > 0 ? (
                    <>
                      <h4>Спасено носильщиками</h4>
                      {renderLootList(run.resultSummary.savedByPorters, resolveItemName)}
                    </>
                  ) : null}
                  {run.resultSummary.lostLoot.length > 0 ? (
                    <>
                      <h4>Потеряно</h4>
                      {renderLootList(run.resultSummary.lostLoot, resolveItemName)}
                    </>
                  ) : null}
                  {run.resultSummary.specialFinds.length > 0 ? (
                    <>
                      <h4>Особые свойства</h4>
                      {run.resultSummary.specialFinds.map((entry, index) => (
                        <p key={`${entry.itemId}-${entry.propertyId}-${index}`}>
                          <span>{fixMojibake(resolveItemName(entry.itemId))}</span>
                          <strong>{fixMojibake(entry.propertyId)}</strong>
                        </p>
                      ))}
                    </>
                  ) : null}
                  {run.skillEffectLog?.length ? (
                    <>
                      <h4>Влияние навыков</h4>
                      {run.skillEffectLog.map((entry, index) => <p key={`skill-log-${index}`}>{fixMojibake(entry)}</p>)}
                    </>
                  ) : null}
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
              <button disabled={!canEscape} onClick={onEscape}>Выйти из шахты</button>
              <button disabled={!canRetreat} onClick={onRetreat}>Отступить</button>
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
            width: min(1180px, calc(100vw - 48px));
            max-height: calc(100vh - 48px);
            display: flex;
            flex-direction: column;
            gap: 1rem;
            background: linear-gradient(180deg, rgba(17, 14, 12, 0.98), rgba(9, 8, 7, 0.98));
          }
          .mining-layout {
            display: grid;
            grid-template-columns: 260px minmax(0, 1fr) 280px;
            gap: 1rem;
            align-items: start;
          }
          .mining-panel {
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(27, 22, 18, 0.95);
            padding: 0.9rem;
            border-radius: 8px;
          }
          .mining-panel h3 {
            margin: 0 0 0.5rem 0;
          }
          .mining-center {
            display: flex;
            justify-content: center;
          }
          .mining-grid {
            display: grid;
            gap: 0.5rem;
            width: min(100%, 540px);
          }
          .mine-block {
            min-height: 72px;
            border-radius: 8px;
            border: 1px solid rgba(164, 141, 110, 0.25);
            background: rgba(53, 42, 33, 0.98);
            color: #efe3d2;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 0.2rem;
            padding: 0.4rem;
            transition: transform 120ms ease, opacity 120ms ease;
          }
          .mine-block.is-closed:hover:not(:disabled) {
            transform: translateY(-1px);
          }
          .mine-block.is-opened {
            background: rgba(96, 74, 56, 0.88);
          }
          .mine-block:disabled {
            opacity: 0.88;
            cursor: default;
          }
          .mine-block small {
            color: #cbb8a0;
          }
          .mining-stat-list,
          .mining-loot-list {
            display: grid;
            gap: 0.45rem;
          }
          .mining-stat-list p,
          .mining-loot-list p {
            display: flex;
            justify-content: space-between;
            gap: 0.5rem;
            margin: 0;
          }
          .mining-log {
            min-height: 140px;
            max-height: 180px;
            overflow: auto;
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(18, 15, 13, 0.98);
            border-radius: 8px;
            padding: 0.8rem;
          }
          .mining-log p {
            margin: 0 0 0.4rem 0;
          }
          .mining-result-summary {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(164, 141, 110, 0.22);
            display: grid;
            gap: 0.75rem;
          }
          .mining-result-details {
            display: grid;
            gap: 0.45rem;
          }
          .mining-result-details h4 {
            margin: 0.35rem 0 0;
            font-size: 0.9rem;
          }
          .mining-actions {
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
          }
          @media (max-width: 980px) {
            .mining-layout {
              grid-template-columns: 1fr;
            }
            .mining-center {
              order: -1;
            }
          }
        `}</style>
      </section>
    </div>
  );
}
