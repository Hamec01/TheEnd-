import React, { useState } from 'react';
import { ProfessionSkillEditor } from './ProfessionSkillEditor';
import { ProfessionBranchEditor } from './ProfessionBranchEditor';
import { MiningMinesTab, MiningDepthsTab, MiningBlocksTab, MiningHazardsTab, MiningLootTab } from '../mining/MiningTabPlaceholders';

type TabType = 'general' | 'skills' | 'branches' | 'mines' | 'depths' | 'blocks' | 'hazards' | 'loot' | 'recipes' | 'actions' | 'buffs' | 'locations' | 'fish' | 'bait' | 'ingredients' | 'prey' | 'weapons' | string;

interface ProfessionEditorTabsProps {
  professionId: string;
  professionName: string;
  onBack: () => void;
}

// Карта специфичных для профессии табов
const PROFESSION_SPECIFIC_TABS: Record<string, Array<{ id: string; label: string }>> = {
  'mining': [
    { id: 'mines', label: 'Шахты' },
    { id: 'depths', label: 'Глубины' },
    { id: 'blocks', label: 'Блоки' },
    { id: 'hazards', label: 'Опасности' },
    { id: 'loot', label: 'Добыча' },
  ],
  'blacksmithing': [
    { id: 'recipes', label: 'Рецепты' },
    { id: 'actions', label: 'Кузнечные действия' },
    { id: 'buffs', label: 'Баффы' },
  ],
  'fishing': [
    { id: 'locations', label: 'Озёра' },
    { id: 'fish', label: 'Рыба' },
    { id: 'bait', label: 'Наживки' },
  ],
  'cooking': [
    { id: 'recipes', label: 'Рецепты' },
    { id: 'ingredients', label: 'Ингредиенты' },
  ],
  'hunting': [
    { id: 'locations', label: 'Охотничьи угодья' },
    { id: 'prey', label: 'Добыча' },
    { id: 'weapons', label: 'Оружие' },
  ],
};

export function ProfessionEditorTabs({ professionId, professionName, onBack }: ProfessionEditorTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  const commonTabs: Array<{ id: TabType; label: string }> = [
    { id: 'general', label: 'Общее' },
    { id: 'skills', label: 'Навыки' },
    { id: 'branches', label: 'Ветки' },
  ];

  const customTabs = PROFESSION_SPECIFIC_TABS[professionId] || [];
  const allTabs = [...commonTabs, ...customTabs.map(t => ({ id: t.id as TabType, label: t.label }))];

  return (
    <div className="profession-editor-tabs">
      <div className="profession-editor-header">
        <button onClick={onBack} className="btn-back">← Назад к профессиям</button>
        <h2>{professionName}</h2>
      </div>

      <div className="tabs-container">
        <div className="tabs-nav">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tabs-content">
          {activeTab === 'general' && (
            <div className="tab-pane">
              <p className="muted">Базовые параметры профессии "{professionName}"</p>
              <p style={{ marginTop: '1rem' }}>Редактор базовых параметров сейчас не реализован, но будет содержать:</p>
              <ul>
                <li>Название и описание</li>
                <li>Категорию</li>
                <li>Максимальный уровень</li>
                <li>Иконку</li>
                <li>Статус включения</li>
              </ul>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="tab-pane">
              <ProfessionSkillEditor
                professions={[{ id: professionId, name: professionName }]}
                filterByProfession={professionId}
              />
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="tab-pane">
              <ProfessionBranchEditor
                professions={[{ id: professionId, name: professionName }]}
                filterByProfession={professionId}
              />
            </div>
          )}

          {(customTabs.some(t => t.id === activeTab)) && (
            <div className="tab-pane">
              {professionId === 'mining' && activeTab === 'mines' && <MiningMinesTab professionName={professionName} />}
              {professionId === 'mining' && activeTab === 'depths' && <MiningDepthsTab professionName={professionName} />}
              {professionId === 'mining' && activeTab === 'blocks' && <MiningBlocksTab professionName={professionName} />}
              {professionId === 'mining' && activeTab === 'hazards' && <MiningHazardsTab professionName={professionName} />}
              {professionId === 'mining' && activeTab === 'loot' && <MiningLootTab professionName={professionName} />}
              
              {!(professionId === 'mining') && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p>Раздел "{allTabs.find(t => t.id === activeTab)?.label}" будет реализован для этой профессии</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>professionId: {professionId}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .profession-editor-tabs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .profession-editor-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .profession-editor-header h2 {
          margin: 0;
          flex: 1;
        }
        .btn-back {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--panel-border);
          color: var(--text-main);
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .btn-back:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--panel-border-strong);
        }
        .tabs-container {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .tabs-nav {
          display: flex;
          gap: 0;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--panel-border);
        }
        .tab-button {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .tab-button:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.03);
        }
        .tab-button.is-active {
          border-bottom-color: var(--text-accent, #a89;
          color: var(--text-accent, #aaa);
        }
        .tab-pane {
          padding: 1.5rem;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
