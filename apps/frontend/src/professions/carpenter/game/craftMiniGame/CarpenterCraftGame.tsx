import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import type { CarpenterGameInput, CarpenterGameResult, PassStats } from './carpenterGameTypes';
import { CarpenterCraftScene, SCENE_KEY } from './CarpenterCraftScene';
import { computeGrade } from './carpenterGameBalance';
import { getGradeLabel, getGradeColor } from './carpenterGameAssets';

interface Props {
  config: CarpenterGameInput;
  onComplete: (result: CarpenterGameResult) => void;
  onCancel?: (result: CarpenterGameResult) => void;
}

type OverlayState = 'none' | 'decision' | 'broken';

export function CarpenterCraftGame({ config, onComplete, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CarpenterCraftScene | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>('none');
  const [passStats, setPassStats] = useState<PassStats | null>(null);

  const handlePassComplete = useCallback((stats: PassStats) => {
    setPassStats(stats);
    if (stats.broken) {
      setOverlay('broken');
    } else {
      setOverlay('decision');
    }
  }, []);

  const handleGameOver = useCallback((result: CarpenterGameResult) => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    if (result.reason === 'cancelled') {
      onCancel?.(result);
    } else {
      onComplete(result);
    }
  }, [onComplete, onCancel]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new CarpenterCraftScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      backgroundColor: '#0d0804',
      parent: containerRef.current,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      input: {
        keyboard: true,
        mouse: true,
      },
    });

    gameRef.current = game;

    game.events.once('ready', () => {
      game.scene.add(SCENE_KEY, scene, false);
      game.scene.start(SCENE_KEY, {
        config,
        callbacks: {
          onPassComplete: handlePassComplete,
          onGameOver: handleGameOver,
        },
      });
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        event.stopPropagation();
        sceneRef.current?.setExternalActionDown(true);
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        sceneRef.current?.cancelGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        event.stopPropagation();
        sceneRef.current?.setExternalActionDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      sceneRef.current?.setExternalActionDown(false);
    };
  }, []);

  const handleTakeResult = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const result = scene.finishEarly();
    setOverlay('none');
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    onComplete(result);
  };

  const handleOneMorePass = () => {
    setOverlay('none');
    const scene = sceneRef.current;
    if (!scene) return;
    const maxPasses = config.maxPasses ?? 5;
    if (passStats && passStats.passNumber >= maxPasses) {
      handleTakeResult();
      return;
    }
    scene.continuePass();
  };

  const handleBrokenOk = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const result = scene.buildResult('material_broken');
    setOverlay('none');
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    onComplete(result);
  };

  const canTakeResult = passStats ? passStats.progress >= 40 : false;
  const maxPasses = config.maxPasses ?? 5;
  const atMaxPass = passStats ? passStats.passNumber >= maxPasses : false;
  const integrityLow = passStats ? passStats.integrityRemaining < 25 : false;

  const currentGrade = passStats
    ? computeGrade(passStats.qualityScore, passStats.integrityRemaining, passStats.progress)
    : 'poor';

  const gradeHex = getGradeColor(currentGrade);
  const gradeLabel = getGradeLabel(currentGrade);
  const gradeCss = '#' + gradeHex.toString(16).padStart(6, '0');

  return (
    <div style={{ position: 'relative', width: '100%', height: 'min(720px, calc(96vh - 120px))', minHeight: 520, background: '#0d0804', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        tabIndex={0}
        onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
        style={{ width: '100%', height: '100%', outline: 'none' }}
      />

      {overlay === 'decision' && passStats && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5, 3, 1, 0.78)',
          backdropFilter: 'blur(2px)',
          zIndex: 10,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #1e1008 0%, #130a04 100%)',
            border: '1.5px solid #7a4a22',
            borderRadius: 12,
            padding: '36px 48px',
            minWidth: 420,
            fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
            color: '#f5e8c8',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: '#8a6040', letterSpacing: 2, marginBottom: 6 }}>ПРОХОД {passStats.passNumber} ЗАВЕРШЁН</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#c08040', marginBottom: 28 }}>Ещё один проход?</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20, textAlign: 'left' }}>
              <StatRow label="Качество" value={`${passStats.qualityScore}%`} color="#ffe066" />
              <StatRow label="Целостность" value={`${passStats.integrityRemaining}%`} color={passStats.integrityRemaining > 35 ? '#4cde68' : '#e03030'} />
              <StatRow label="Прогресс" value={`${passStats.progress}%`} color="#5abaff" />
              <StatRow label="Мастерство" value={`${passStats.masteryChance}%`} color="#c8a0f0" />
              <StatRow label="Ошибки" value={String(passStats.mistakes)} color={passStats.mistakes > 2 ? '#e03030' : '#d0d0d0'} />
              <StatRow label="Хитов" value={String(passStats.hitsScored)} color="#d0d0d0" />
            </div>

            <div style={{ marginBottom: 20, padding: '10px 0', borderTop: '1px solid #3a2010', borderBottom: '1px solid #3a2010' }}>
              <div style={{ fontSize: 12, color: '#8a6040', marginBottom: 4 }}>ТЕКУЩИЙ РЕЗУЛЬТАТ</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: gradeCss }}>{gradeLabel}</div>
            </div>

            {integrityLow && (
              <div style={{ marginBottom: 14, padding: '8px 14px', background: 'rgba(180,20,20,0.15)', border: '1px solid #8a2020', borderRadius: 6, fontSize: 13, color: '#e07070' }}>
                ⚠ Материал близок к разрушению!
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!atMaxPass && (
                <button onClick={handleOneMorePass} style={btnStyle('#c08040', '#1a0c04')}>
                  Ещё один проход →
                </button>
              )}
              <button
                onClick={handleTakeResult}
                disabled={!canTakeResult}
                style={btnStyle(canTakeResult ? '#4cde68' : '#4a4a4a', canTakeResult ? '#041204' : '#1a1a1a', !canTakeResult)}
              >
                {canTakeResult ? 'Взять результат' : `Нужно 40% прогресса (сейчас ${passStats.progress}%)`}
              </button>
              <button onClick={() => { sceneRef.current?.cancelGame(); setOverlay('none'); }} style={{ background: 'transparent', border: '1px solid #4a3020', borderRadius: 6, color: '#8a6040', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}

      {overlay === 'broken' && passStats && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(20, 2, 2, 0.85)',
          backdropFilter: 'blur(3px)',
          zIndex: 10,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #1a0808 0%, #0d0404 100%)',
            border: '1.5px solid #8b2020',
            borderRadius: 12,
            padding: '36px 48px',
            minWidth: 380,
            fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
            color: '#f5e8c8',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✕</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#e03030', marginBottom: 8 }}>Материал сломан</div>
            <div style={{ fontSize: 14, color: '#9a6060', marginBottom: 28 }}>{config.materialName} не выдержал нагрузки</div>
            <div style={{ marginBottom: 24, color: '#7a5050', fontSize: 13 }}>
              Проходов: {passStats.passNumber} · Ошибок: {passStats.mistakes}
            </div>
            <button onClick={handleBrokenOk} style={btnStyle('#e03030', '#150505')}>
              Принять поражение
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <>
      <span style={{ fontSize: 13, color: '#8a6040' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 'bold', color, textAlign: 'right' }}>{value}</span>
    </>
  );
}

function btnStyle(borderColor: string, bg: string, disabled = false): React.CSSProperties {
  return {
    background: bg,
    border: `1.5px solid ${borderColor}`,
    borderRadius: 7,
    color: disabled ? '#6a6a6a' : borderColor,
    padding: '12px 20px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
    fontSize: 15,
    fontWeight: 'bold',
    transition: 'all 0.15s',
    opacity: disabled ? 0.6 : 1,
  };
}
