import { useEffect, useMemo, useState } from 'react';
import type { AdminItem } from '../../services/content/models';
import { GameImageView } from '../components/GameImageView';
import { loadRuntimeAdminContent } from '../../services/content/runtimeContentService';
import {
  readPlayerItemInstances,
  removePlayerItemInstanceByItemId,
  resolveEffectiveAdminItem,
} from '../../services/playerItemInstances';

function getItemCoreSummary(item: AdminItem | null): string {
  if (!item) {
    return 'Нет snapshot-предмета';
  }
  if (typeof item.damageMin === 'number' || typeof item.damageMax === 'number') {
    return `Урон: ${item.damageMin ?? 0}-${item.damageMax ?? item.damageMin ?? 0}`;
  }
  if (typeof item.armorValue === 'number') {
    return `Броня: ${item.armorValue}`;
  }
  return item.type;
}

export function ItemInstancesPage() {
  const [query, setQuery] = useState('');
  const [itemsCatalog, setItemsCatalog] = useState<AdminItem[]>([]);
  const [revision, setRevision] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadRuntimeAdminContent().then((content) => {
      if (!active) {
        return;
      }
      setItemsCatalog(content.items ?? []);
    }).catch(() => undefined);
    const onStorage = () => setRevision((current) => current + 1);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const instances = useMemo(
    () => readPlayerItemInstances(),
    [revision],
  );

  const filtered = useMemo(() => {
    const probe = query.trim().toLowerCase();
    if (!probe) {
      return instances;
    }
    return instances.filter((entry) => {
      const effective = resolveEffectiveAdminItem(entry.itemId, itemsCatalog, instances);
      return [
        entry.id,
        entry.itemId,
        entry.sourceItemId,
        entry.customName,
        entry.craftedFromTemplateId,
        entry.notes,
        effective?.name,
        effective?.subtype,
        ...(entry.tags ?? []),
      ].some((value) => String(value ?? '').toLowerCase().includes(probe));
    });
  }, [instances, itemsCatalog, query]);

  const selected = useMemo(
    () => filtered.find((entry) => entry.itemId === selectedItemId) ?? filtered[0] ?? null,
    [filtered, selectedItemId],
  );

  useEffect(() => {
    if (!selected && filtered[0]) {
      setSelectedItemId(filtered[0].itemId);
    }
  }, [filtered, selected]);

  const selectedEffective = useMemo(
    () => (selected ? resolveEffectiveAdminItem(selected.itemId, itemsCatalog, instances) : null),
    [instances, itemsCatalog, selected],
  );

  return (
    <div className="admin-stack">
      <section className="admin-toolbar" style={{ display: 'grid', gap: 12 }}>
        <div>
          <strong>PLAYER ITEM INSTANCES</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Отдельный реестр уникальных вещей игрока. Здесь лежат выкованные, доработанные и именованные предметы,
            чтобы обычный каталог предметов не разрастался до мусорки.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по id, имени, шаблону, тегам"
            style={{ minWidth: 320 }}
          />
          <button type="button" onClick={() => setRevision((current) => current + 1)}>Обновить</button>
          {selected ? (
            <button
              type="button"
              onClick={() => {
                removePlayerItemInstanceByItemId(selected.itemId);
                setRevision((current) => current + 1);
              }}
            >
              Удалить запись
            </button>
          ) : null}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
        <section className="card" style={{ padding: 12, display: 'grid', gap: 8, maxHeight: '70vh', overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="muted">Пока нет player-crafted экземпляров.</div>
          ) : filtered.map((entry) => {
            const effective = resolveEffectiveAdminItem(entry.itemId, itemsCatalog, instances);
            const isSelected = selected?.itemId === entry.itemId;
            return (
              <button
                key={entry.id}
                type="button"
                className={isSelected ? 'is-active' : ''}
                onClick={() => setSelectedItemId(entry.itemId)}
                style={{
                  textAlign: 'left',
                  border: '1px solid var(--admin-border, #6f5731)',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(201, 162, 98, 0.12)' : 'transparent',
                  padding: 10,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, flex: '0 0 56px' }}>
                    <GameImageView imageRef={effective?.imageRef} legacyImagePath={effective?.imagePath} alt={effective?.name ?? entry.itemId} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{effective?.name ?? entry.customName ?? entry.itemId}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{entry.itemId}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{getItemCoreSummary(effective)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
          {!selected ? (
            <div className="muted">Выберите экземпляр слева.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 128, height: 128, flex: '0 0 128px' }}>
                  <GameImageView imageRef={selectedEffective?.imageRef} legacyImagePath={selectedEffective?.imagePath} alt={selectedEffective?.name ?? selected.itemId} />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <h3 style={{ margin: 0 }}>{selectedEffective?.name ?? selected.customName ?? selected.itemId}</h3>
                  <div className="muted">{selected.itemId}</div>
                  <div>{getItemCoreSummary(selectedEffective)}</div>
                  <div className="muted">Источник: {selected.sourceItemId ?? 'нет'}</div>
                  <div className="muted">Шаблон: {selected.craftedFromTemplateId ?? 'нет'}</div>
                  <div className="muted">Качество: {selected.qualityTierId ?? 'нет'}</div>
                  <div className="muted">Forge score: {selected.forgeScore ?? '—'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <strong>Теги</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {(selected.tags ?? selectedEffective?.tags ?? []).join(', ') || '—'}
                  </div>
                </div>
                <div>
                  <strong>Материалы ковки</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {(selected.craftedMaterialIds ?? []).join(', ') || '—'}
                  </div>
                </div>
              </div>

              <div>
                <strong>Описание</strong>
                <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedEffective?.gameplayDescription || selected.notes || '—'}
                </p>
              </div>

              <div>
                <strong>Snapshot JSON</strong>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 300 }}>
                  {JSON.stringify(selected.itemSnapshot ?? null, null, 2)}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
