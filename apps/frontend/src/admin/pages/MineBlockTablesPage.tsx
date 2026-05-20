import { MineBlockTableEditor } from '../mining/MineBlockTableEditor';

export function MineBlockTablesPage() {
  return <MineBlockTableEditor mines={[
    { id: 'mine_example', name: 'Пример шахты' },
  ]} />;
}
