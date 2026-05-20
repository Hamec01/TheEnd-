import { ProfessionBranchEditor } from '../professions/ProfessionBranchEditor';

export function ProfessionBranchesPage() {
  return <ProfessionBranchEditor professions={[
    { id: 'mining', name: 'Горняк' },
    { id: 'blacksmithing', name: 'Кузнец' },
    { id: 'carpentry', name: 'Плотник' },
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
