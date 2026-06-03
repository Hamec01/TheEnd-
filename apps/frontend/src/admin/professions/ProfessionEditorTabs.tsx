import React, { useState } from 'react';
import { BlacksmithBalanceEditor } from '../blacksmith/BlacksmithBalanceEditor';
import { BlacksmithForgeTierEditor } from '../blacksmith/BlacksmithForgeTierEditor';
import { BlacksmithModuleEditor } from '../blacksmith/BlacksmithModuleEditor';
import { BlacksmithQualityEditor } from '../blacksmith/BlacksmithQualityEditor';
import { BlacksmithStageConfigEditor } from '../blacksmith/BlacksmithStageConfigEditor';
import { BlacksmithToolEditor } from '../blacksmith/BlacksmithToolEditor';
import { BlacksmithVisualEditor } from '../blacksmith/BlacksmithVisualEditor';
import { MiningBlocksTab, MiningDepthsTab, MiningHazardsTab, MiningLootTab, MiningMinesTab, MiningToolsTab } from '../mining/MiningTabPlaceholders';
import { ProfessionBranchEditor } from './ProfessionBranchEditor';
import { ProfessionSkillEditor } from './ProfessionSkillEditor';

type TabType =
  | 'general'
  | 'skills'
  | 'branches'
  | 'mines'
  | 'depths'
  | 'blocks'
  | 'hazards'
  | 'loot'
  | 'tools'
  | 'forgeTiers'
  | 'modules'
  | 'blacksmithTools'
  | 'stages'
  | 'quality'
  | 'visual'
  | 'balance';

interface ProfessionEditorTabsProps {
  professionId: string;
  professionName: string;
  onBack: () => void;
}

const PROFESSION_SPECIFIC_TABS: Record<string, Array<{ id: TabType; label: string }>> = {
  mining: [
    { id: 'mines', label: 'Шахты' },
    { id: 'depths', label: 'Глубины' },
    { id: 'blocks', label: 'Блоки' },
    { id: 'hazards', label: 'Опасности' },
    { id: 'loot', label: 'Добыча' },
    { id: 'tools', label: 'Инструменты' },
  ],
  blacksmithing: [
    { id: 'forgeTiers', label: 'Кузни' },
    { id: 'modules', label: 'Модули' },
    { id: 'blacksmithTools', label: 'Инструменты' },
    { id: 'stages', label: 'Этапы' },
    { id: 'quality', label: 'Качество' },
    { id: 'visual', label: 'Визуал' },
    { id: 'balance', label: 'XP / Баланс' },
  ],
};

export function ProfessionEditorTabs({ professionId, professionName, onBack }: ProfessionEditorTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  const commonTabs: Array<{ id: TabType; label: string }> = [
    { id: 'general', label: 'Общее' },
    { id: 'skills', label: 'Навыки' },
    { id: 'branches', label: 'Ветки' },
  ];

  const customTabs = PROFESSION_SPECIFIC_TABS[professionId] ?? [];
  const allTabs = [...commonTabs, ...customTabs];

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
          {activeTab === 'general' ? (
            <div className="tab-pane">
              <p className="muted">Базовые параметры профессии "{professionName}".</p>
            </div>
          ) : null}

          {activeTab === 'skills' ? (
            <div className="tab-pane">
              <ProfessionSkillEditor professions={[{ id: professionId, name: professionName }]} filterByProfession={professionId} />
            </div>
          ) : null}

          {activeTab === 'branches' ? (
            <div className="tab-pane">
              <ProfessionBranchEditor professions={[{ id: professionId, name: professionName }]} filterByProfession={professionId} />
            </div>
          ) : null}

          {professionId === 'mining' && activeTab === 'mines' ? <div className="tab-pane"><MiningMinesTab professionName={professionName} /></div> : null}
          {professionId === 'mining' && activeTab === 'depths' ? <div className="tab-pane"><MiningDepthsTab professionName={professionName} /></div> : null}
          {professionId === 'mining' && activeTab === 'blocks' ? <div className="tab-pane"><MiningBlocksTab professionName={professionName} /></div> : null}
          {professionId === 'mining' && activeTab === 'hazards' ? <div className="tab-pane"><MiningHazardsTab professionName={professionName} /></div> : null}
          {professionId === 'mining' && activeTab === 'loot' ? <div className="tab-pane"><MiningLootTab professionName={professionName} /></div> : null}
          {professionId === 'mining' && activeTab === 'tools' ? <div className="tab-pane"><MiningToolsTab professionName={professionName} /></div> : null}

          {professionId === 'blacksmithing' && activeTab === 'forgeTiers' ? <div className="tab-pane"><BlacksmithForgeTierEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'modules' ? <div className="tab-pane"><BlacksmithModuleEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'blacksmithTools' ? <div className="tab-pane"><BlacksmithToolEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'stages' ? <div className="tab-pane"><BlacksmithStageConfigEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'quality' ? <div className="tab-pane"><BlacksmithQualityEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'visual' ? <div className="tab-pane"><BlacksmithVisualEditor /></div> : null}
          {professionId === 'blacksmithing' && activeTab === 'balance' ? <div className="tab-pane"><BlacksmithBalanceEditor /></div> : null}
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
          border-bottom-color: var(--text-accent, #a89);
          color: var(--text-accent, #aaa);
        }
        .tab-pane {
          padding: 1.5rem;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
