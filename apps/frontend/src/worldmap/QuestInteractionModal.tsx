import { useEffect, useState } from 'react';
import { imageService } from '../services/content/imageService';
import type { QuestInteractionChoice, QuestInteractionDefinition } from '../types/quest';

export function QuestInteractionModal(props: {
  interaction: QuestInteractionDefinition | null;
  choices?: QuestInteractionChoice[];
  onClose: () => void;
  onChoice: (choice: QuestInteractionChoice) => void;
}) {
  const { interaction, choices, onClose, onChoice } = props;
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
  const [resultText, setResultText] = useState<string | null>(null);
  const [lastChoice, setLastChoice] = useState<QuestInteractionChoice | null>(null);

  useEffect(() => {
    setResultText(null);
    setLastChoice(null);
  }, [interaction?.id]);

  useEffect(() => {
    let cancelled = false;
    const imageId = interaction?.imageId?.trim();
    if (!imageId) {
      setResolvedImageUrl('');
      return;
    }

    if (!imageId.startsWith('img_')) {
      setResolvedImageUrl(imageId);
      return;
    }

    imageService
      .get(imageId)
      .then((entry) => {
        if (!cancelled) {
          setResolvedImageUrl(entry?.dataUrl ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedImageUrl('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [interaction?.imageId]);

  if (!interaction) {
    return null;
  }

  const hasResult = Boolean(resultText);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
        background: 'rgba(6, 4, 2, 0.74)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="card" style={{ width: 'min(760px, 100%)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{interaction.title || 'Событие'}</h2>
          <button onClick={onClose}>Закрыть</button>
        </div>

        {resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt={interaction.title || 'quest interaction'}
            style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, marginTop: 12 }}
          />
        ) : null}

        <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{interaction.text}</p>

        {hasResult ? (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{resultText}</p>
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  if (lastChoice?.close === false) {
                    setResultText(null);
                    setLastChoice(null);
                    return;
                  }
                  onClose();
                }}
              >
                {lastChoice?.close === false ? 'Продолжить' : 'Закрыть'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {(choices ?? interaction.choices ?? []).map((choice) => (
              <button
                key={choice.id}
                onClick={() => {
                  onChoice(choice);
                  if (choice.resultText?.trim()) {
                    setLastChoice(choice);
                    setResultText(choice.resultText.trim());
                    return;
                  }
                  if (choice.close !== false) {
                    onClose();
                  }
                }}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
