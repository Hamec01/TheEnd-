import type { DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';

interface NpcInteractionPanelProps {
  npc: NpcDefinition | null;
  dialogue: DialogueDefinition | null;
  node: DialogueNode | null;
  logs: string[];
  onTalk: () => void;
  onTrade: () => void;
  onTrain: () => void;
  onAttack: () => void;
  onQuest: () => void;
  onInspect: () => void;
  onSelectChoice: (choiceId: string) => void;
}

function resolvePortrait(npc: NpcDefinition | null): string {
  return npc?.portraitUrl || npc?.iconUrl || '/assets/placeholders/unknown_portrait.png';
}

export function NpcInteractionPanel(props: NpcInteractionPanelProps) {
  const {
    npc,
    dialogue,
    node,
    logs,
    onTalk,
    onTrade,
    onTrain,
    onAttack,
    onQuest,
    onInspect,
    onSelectChoice,
  } = props;

  if (!npc) {
    return (
      <section className="wm-context card">
        <section className="wm-context-block">
          <h3>NPC</h3>
          <p className="muted">Рядом нет NPC для взаимодействия.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="wm-context card">
      <section className="wm-context-block">
        <h3>NPC Interaction</h3>
        <div className="wm-city-merchant-hotspot" style={{ position: 'static', width: '100%', cursor: 'default' }}>
          <img src={resolvePortrait(npc)} alt={npc.name} />
          <span className="wm-city-merchant-copy">
            <strong>{npc.name}</strong>
            <span>{npc.title || npc.kind}</span>
          </span>
        </div>

        <p className="muted">{npc.description || 'Описание отсутствует.'}</p>
        <p className="muted">Disposition: {npc.defaultDisposition}</p>

        <div className="wm-action-grid">
          {npc.canTalk ? <button onClick={onTalk}>Talk</button> : null}
          {npc.canTrade && npc.traderId ? <button onClick={onTrade}>Trade</button> : null}
          {npc.canTrain ? <button onClick={onTrain}>Train</button> : null}
          {(npc.canFight || npc.defaultDisposition === 'hostile' || npc.defaultDisposition === 'aggressive_on_sight') ? <button onClick={onAttack}>Attack</button> : null}
          {npc.canGiveQuests ? <button onClick={onQuest}>Quest</button> : null}
          <button onClick={onInspect}>Inspect</button>
        </div>
      </section>

      {dialogue && node ? (
        <section className="wm-context-block">
          <h3>Dialogue: {dialogue.title}</h3>
          <p>{node.text || '...'}</p>
          <div className="wm-action-grid">
            {node.choices.map((choice) => (
              <button key={choice.id} onClick={() => onSelectChoice(choice.id)}>
                {choice.text || choice.id}
                {choice.questIconMode && choice.questIconMode !== 'none' ? ` [${choice.questIconMode}]` : ''}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {logs.length > 0 ? (
        <section className="wm-context-block">
          <h3>Dialogue Log</h3>
          {logs.slice(-6).map((entry) => <p key={entry} className="muted">{entry}</p>)}
        </section>
      ) : null}
    </section>
  );
}
