import { ProfessionSkillEditor } from '../professions/ProfessionSkillEditor';

export function ProfessionSkillsPage() {
  return <ProfessionSkillEditor professions={[
    { id: 'mining', name: 'Горняк' },
    { id: 'blacksmithing', name: 'Кузнец' },
    { id: 'carpenter', name: 'Плотник' },
    { id: 'leatherworking', name: 'Кожевник' },
    { id: 'jewelcrafting', name: 'Ювелир' },
    { id: 'runecrafting', name: 'Рунорез' },
    { id: 'fishing', name: 'Рыбак' },
    { id: 'cooking', name: 'Повар' },
    { id: 'hunting', name: 'Охотник' },
    { id: 'alchemy', name: 'Алхимик' },
    { id: 'herbalism', name: 'Травник' },
  ]} />;
}
