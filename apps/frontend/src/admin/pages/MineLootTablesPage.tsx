import React, { useState } from 'react';

interface LootTableEntryItem {
  itemId: string;
  weight: number;
  minQuantity?: number;
  maxQuantity?: number;
}

interface LootTable {
  id: string;
  name: string;
  sourceType?: string;
  entries: LootTableEntryItem[];
}

export function MineLootTablesPage() {
  // В реальной реализации это будет загружаться с backend
  const [lootTables] = useState<LootTable[]>([
    {
      id: 'loot_mine_iron',
      name: 'Железная добыча',
      sourceType: 'mine',
      entries: [
        { itemId: 'ore_iron', weight: 40, minQuantity: 1, maxQuantity: 3 },
        { itemId: 'ore_copper', weight: 30, minQuantity: 1, maxQuantity: 2 },
        { itemId: 'gold_dust', weight: 20, minQuantity: 1, maxQuantity: 1 },
      ],
    },
  ]);

  const mineLootTables = lootTables.filter(t => t.sourceType === 'mine' || t.id.startsWith('loot_mine_'));

  return (
    <div className="mine-loot-tables">
      <p className="muted">Таблицы добычи для горнякой системы (sourceType: mine)</p>
      
      <div className="table-list">
        {mineLootTables.length > 0 ? (
          mineLootTables.map(table => (
            <div key={table.id} className="table-card card">
              <h4>{table.name}</h4>
              <p className="muted">{table.id}</p>
              <div className="entries">
                {table.entries?.map((entry, idx) => (
                  <div key={idx} style={{ fontSize: '0.9rem', padding: '0.25rem 0' }}>
                    <span>{entry.itemId}</span>
                    <span style={{ marginLeft: '1rem' }}>Вес: {entry.weight}</span>
                    {entry.minQuantity && <span style={{ marginLeft: '0.5rem' }}>×{entry.minQuantity}-{entry.maxQuantity}</span>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary">✏️ Редактировать</button>
                <button className="btn-secondary">👁️ Используется в</button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted" style={{ padding: '1rem' }}>Нет таблиц добычи для горнякой системы. Создайте их в разделе "Таблицы добычи" с помощью интеграции.</p>
        )}
      </div>

      <style>{`
        .mine-loot-tables {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .table-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        .table-card {
          padding: 1rem;
        }
        .table-card h4 {
          margin: 0 0 0.5rem 0;
        }
        .entries {
          background: #f9f9f9;
          padding: 0.5rem;
          border-radius: 4px;
          margin: 0.5rem 0;
        }
        .btn-secondary {
          padding: 0.5rem 1rem;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
