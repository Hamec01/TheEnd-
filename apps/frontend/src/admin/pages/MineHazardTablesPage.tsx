import { MineHazardTableEditor } from '../mining/MineHazardTableEditor';

export function MineHazardTablesPage() {
  return <MineHazardTableEditor hazards={[
    { id: 'trap_basic', name: 'Простая ловушка' },
    { id: 'cave_in', name: 'Обвал' },
    { id: 'gas_pocket', name: 'Газовая карманчик' },
  ]} />;
}
