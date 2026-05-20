import { useMemo, useState } from 'react';
import {
  PROFESSION_DEFINITIONS,
  unlockProfession,
  type PlayerProfessionsState,
  type ProfessionId,
} from '@theend/rpg-domain';

interface PlayerProfessionsPanelProps {
  professionsState: PlayerProfessionsState;
  onClose: () => void;
  onStatus: (text: string) => void;
  onChange: (next: PlayerProfessionsState) => void;
}

export function PlayerProfessionsPanel(props: PlayerProfessionsPanelProps) {
  const { professionsState, onClose, onStatus, onChange } = props;

  const [selectedProfessionId, setSelectedProfessionId] = useState<ProfessionId | null>(null);
  const definitionById = useMemo(
    () => new Map(PROFESSION_DEFINITIONS.map((entry) => [entry.id, entry])),
    [],
  );

  const unlockedProfessions = useMemo(
    () => professionsState.professions.map((entry) => ({
      state: entry,
      definition: definitionById.get(entry.professionId) ?? null,
    })),
    [definitionById, professionsState.professions],
  );

  const selectedProfession = useMemo(
    () => unlockedProfessions.find((entry) => entry.state.professionId === selectedProfessionId) ?? null,
    [selectedProfessionId, unlockedProfessions],
  );

  const isDev = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true
    || ((import.meta as { env?: { MODE?: string } }).env?.MODE ?? 'production') !== 'production';

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal">
        <div className="battle-window-head">
          <h2>Профессии</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {isDev ? (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                const next = unlockProfession(professionsState, 'mining');
                onChange(next);
                onStatus('DEV: профессия Горняк открыта.');
              }}
            >
              DEV: открыть Горняка
            </button>
          </div>
        ) : null}

        {unlockedProfessions.length === 0 ? (
          <p>У вас пока нет профессий. Найдите наставника, чтобы изучить первую профессию.</p>
        ) : (
          <>
            <div className="wm-stat-list" style={{ marginBottom: 12 }}>
              {unlockedProfessions.map((entry) => {
                const definition = entry.definition;
                const state = entry.state;
                const name = definition?.name ?? state.professionId;
                return (
                  <div key={state.professionId} className="wm-stat-row" style={{ alignItems: 'center' }}>
                    <div>
                      <strong>{name}</strong>
                      <p className="wm-stat-hint">Уровень {state.level}</p>
                      <p className="wm-stat-hint">{state.xp} / {state.xpToNextLevel} XP</p>
                      <p className="wm-stat-hint">Очки навыков: {state.skillPoints}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProfessionId(state.professionId)}
                    >
                      Открыть
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedProfession ? (
              <section className="inner-card">
                <h3 style={{ marginTop: 0 }}>{selectedProfession.definition?.name ?? selectedProfession.state.professionId}</h3>
                <p>{selectedProfession.definition?.description ?? 'Описание профессии пока не заполнено.'}</p>
                <p>Уровень: {selectedProfession.state.level}</p>
                <p>XP: {selectedProfession.state.xp} / {selectedProfession.state.xpToNextLevel}</p>
                <p>Очки навыков: {selectedProfession.state.skillPoints}</p>
                <p>Изучено навыков: {selectedProfession.state.learnedSkillIds.length}</p>
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
