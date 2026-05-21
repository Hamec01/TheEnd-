import { MineBlockTableEditor } from './MineBlockTableEditor';
import { MineDepthEditor } from './MineDepthEditor';
import { MineEditor } from './MineEditor';
import { MineHazardEditor } from './MineHazardEditor';
import { MineHazardTableEditor } from './MineHazardTableEditor';
import { MineLootTableEditor } from './MineLootTableEditor';

interface MiningTabProps {
  professionName: string;
}

export function MiningMinesTab(_props: MiningTabProps) {
  return <MineEditor />;
}

export function MiningDepthsTab(_props: MiningTabProps) {
  return <MineDepthEditor />;
}

export function MiningBlocksTab(_props: MiningTabProps) {
  return <MineBlockTableEditor />;
}

export function MiningHazardsTab(_props: MiningTabProps) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section>
        <h3 style={{ margin: '0 0 0.75rem 0' }}>Опасности</h3>
        <MineHazardEditor />
      </section>
      <section>
        <h3 style={{ margin: '0 0 0.75rem 0' }}>Таблицы опасностей</h3>
        <MineHazardTableEditor />
      </section>
    </div>
  );
}

export function MiningLootTab(_props: MiningTabProps) {
  return <MineLootTableEditor />;
}
