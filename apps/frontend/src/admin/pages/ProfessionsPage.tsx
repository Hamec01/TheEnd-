import React, { useState } from 'react';
import { ProfessionsListPage } from '../professions/ProfessionsListPage';
import { ProfessionEditorTabs } from '../professions/ProfessionEditorTabs';
import { ProfessionDefinition } from '../../types/profession';

const PROFESSIONS: Record<string, ProfessionDefinition> = {
  'mining': { id: 'mining', name: 'Горняк', description: 'Добыча полезных ископаемых', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '⛏️' },
  'blacksmithing': { id: 'blacksmithing', name: 'Кузнец', description: 'Изготовление оружия и доспехов', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🔨' },
  'carpenter': { id: 'carpenter', name: 'Плотник', description: 'Работа с деревом', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🪵' },
  'leatherworking': { id: 'leatherworking', name: 'Кожевник', description: 'Изготовление кожаных изделий', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🧥' },
  'jewelcrafting': { id: 'jewelcrafting', name: 'Ювелир', description: 'Изготовление украшений', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '💍' },
  'runecrafting': { id: 'runecrafting', name: 'Рунорез', description: 'Создание магических рун', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '✨' },
  'fishing': { id: 'fishing', name: 'Рыбак', description: 'Ловля рыбы', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🎣' },
  'cooking': { id: 'cooking', name: 'Повар', description: 'Приготовление еды', category: 'crafting', maxLevel: 100, isEnabled: true, icon: '🍳' },
  'hunting': { id: 'hunting', name: 'Охотник', description: 'Охота и отслеживание', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🏹' },
  'alchemy': { id: 'alchemy', name: 'Алхимик', description: 'Создание зелий и элексиров', category: 'alchemy', maxLevel: 100, isEnabled: true, icon: '🧪' },
  'herbalism': { id: 'herbalism', name: 'Травник', description: 'Сбор трав и растений', category: 'gathering', maxLevel: 100, isEnabled: true, icon: '🌿' },
};

export function ProfessionsPage() {
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);

  if (selectedProfession && PROFESSIONS[selectedProfession]) {
    const profession = PROFESSIONS[selectedProfession];
    return (
      <ProfessionEditorTabs
        professionId={profession.id}
        professionName={profession.name}
        onBack={() => setSelectedProfession(null)}
      />
    );
  }

  return <ProfessionsListPage onSelectProfession={setSelectedProfession} />;
}
