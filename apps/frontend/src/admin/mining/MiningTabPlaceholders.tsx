import React from 'react';

interface MiningTabPlaceholderProps {
  professionName: string;
}

export function MiningMinesTab({ professionName }: MiningTabPlaceholderProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>🏔️ Шахты</h3>
      <p>Здесь будут создаваться и редактироваться шахты, связанные с профессией {professionName}.</p>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Редактор будет подключён на следующем этапе.</p>
    </div>
  );
}

export function MiningDepthsTab({ professionName }: MiningTabPlaceholderProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>📊 Глубины шахт</h3>
      <p>Здесь будут редактироваться уровни глубины для шахт профессии {professionName}.</p>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Редактор будет подключён на следующем этапе.</p>
    </div>
  );
}

export function MiningBlocksTab({ professionName }: MiningTabPlaceholderProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>🧱 Таблицы блоков</h3>
      <p>Здесь будут настраиваться типы блоков для шахт профессии {professionName}.</p>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Редактор будет подключён на следующем этапе.</p>
    </div>
  );
}

export function MiningHazardsTab({ professionName }: MiningTabPlaceholderProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>⚠️ Опасности</h3>
      <p>Здесь будут создаваться опасности и ловушки для шахт профессии {professionName}.</p>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Редактор будет подключён на следующем этапе.</p>
    </div>
  );
}

export function MiningLootTab({ professionName }: MiningTabPlaceholderProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>💎 Таблицы добычи</h3>
      <p>Здесь будут настраиваться таблицы добычи для шахт профессии {professionName}.</p>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Редактор будет подключён на следующем этапе.</p>
    </div>
  );
}
