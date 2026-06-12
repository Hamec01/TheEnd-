import React, { useState } from 'react';
import { ProfessionDefinition, translateProfessionCategory } from '../../types/profession';

interface ProfessionsListPageProps {
  onSelectProfession: (professionId: string) => void;
  onOpenWorkshops: () => void;
}

const DEFAULT_PROFESSIONS: ProfessionDefinition[] = [
  { id: 'mining', name: 'Горняк', description: 'Добыча полезных ископаемых', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '⛏️' },
  { id: 'blacksmithing', name: 'Кузнец', description: 'Изготовление оружия и доспехов', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🔨' },
  { id: 'carpenter', name: 'Плотник', description: 'Работа с деревом', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🪵' },
  { id: 'leatherworking', name: 'Кожевник', description: 'Изготовление кожаных изделий', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🧥' },
  { id: 'jewelcrafting', name: 'Ювелир', description: 'Изготовление украшений', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '💍' },
  { id: 'runecrafting', name: 'Рунорез', description: 'Создание магических рун', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '✨' },
  { id: 'fishing', name: 'Рыбак', description: 'Ловля рыбы', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🎣' },
  { id: 'cooking', name: 'Повар', description: 'Приготовление еды', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🍳' },
  { id: 'hunting', name: 'Охотник', description: 'Охота и отслеживание', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🏹' },
  { id: 'alchemy', name: 'Алхимик', description: 'Создание зелий и элексиров', category: 'alchemy', maxLevel: 100, isEnabled: true, icon: '🧪' },
  { id: 'herbalism', name: 'Травник', description: 'Сбор трав и растений', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🌿' },
];

export function ProfessionsListPage({ onSelectProfession, onOpenWorkshops }: ProfessionsListPageProps) {
  const [professions] = useState<ProfessionDefinition[]>(DEFAULT_PROFESSIONS);

  return (
    <div className="professions-list-page">
      <div className="professions-grid">
        <div
          className="profession-card card"
          onClick={onOpenWorkshops}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onOpenWorkshops();
            }
          }}
        >
          <div className="profession-icon">🏭</div>
          <h3>Мастерские</h3>
          <p className="profession-id">professionWorkshops</p>
          <p className="profession-description">Content-driven список мастерских профессий: CRUD, import/export и стартовые сиды.</p>
          <div className="profession-meta">
            <span>Профессии</span>
            <span>Location-ready</span>
            <span>JSON</span>
          </div>
        </div>
        {professions.map((profession) => (
          <div
            key={profession.id}
            className="profession-card card"
            onClick={() => onSelectProfession(profession.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectProfession(profession.id);
              }
            }}
          >
            <div className="profession-icon">{profession.icon || '📚'}</div>
            <h3>{profession.name}</h3>
            <p className="profession-id">{profession.id}</p>
            <p className="profession-description">{profession.description}</p>
            <div className="profession-meta">
              <span>{translateProfessionCategory(profession.category)}</span>
              <span>Макс: {profession.maxLevel}</span>
              <span>{profession.isEnabled ? '✅' : '❌'}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .professions-list-page {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .professions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .profession-card {
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          user-select: none;
        }
        .profession-card:hover {
          transform: translateY(-4px);
          border-color: var(--panel-border-strong);
          background: linear-gradient(180deg, rgba(95, 74, 47, 0.6), rgba(38, 30, 21, 0.7));
        }
        .profession-card:focus-visible {
          outline: 2px solid var(--panel-border-strong);
          outline-offset: 2px;
        }
        .profession-icon {
          font-size: 3rem;
          line-height: 1;
        }
        .profession-card h3 {
          margin: 0;
          font-size: 1.3rem;
          color: var(--text-main);
        }
        .profession-id {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .profession-description {
          margin: 0.5rem 0 0 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
          min-height: 2.4em;
        }
        .profession-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .profession-meta span {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
