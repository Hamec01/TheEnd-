import { AdminFieldLabel } from './adminUi';
import { buildWorldZoneLabel } from '../services/worldRepository';
import type { WorldMapZone } from '../worldmap/zoneEditorTypes';

interface ZoneReferenceInputProps {
  label: string;
  hint?: string;
  listId: string;
  value: string;
  zones: WorldMapZone[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
}

export function ZoneReferenceInput({
  label,
  hint,
  listId,
  value,
  zones,
  onChange,
  placeholder,
  emptyOptionLabel = 'Выберите зону',
}: ZoneReferenceInputProps) {
  const selectedZone = zones.find((zone) => zone.id === value.trim()) ?? null;

  return (
    <label className="admin-zone-reference-field">
      <AdminFieldLabel label={label} hint={hint} />
      <div className="admin-zone-reference-control">
        <input
          list={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? 'Введите zoneId'}
        />
        <datalist id={listId}>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{buildWorldZoneLabel(zone)}</option>)}
        </datalist>
        <select value={selectedZone?.id ?? ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">{emptyOptionLabel}</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{buildWorldZoneLabel(zone)}</option>)}
        </select>
      </div>
      {selectedZone ? (
        <div className="admin-zone-reference-preview muted">
          <strong>{selectedZone.name}</strong>
          <span>Тип: {selectedZone.type}</span>
          <span>Регион: {selectedZone.region || 'не задан'}</span>
          <span>Фракция: {selectedZone.faction || 'не задана'}</span>
          <span>{selectedZone.description}</span>
        </div>
      ) : value.trim() ? (
        <p className="muted">Введён вручную zoneId: {value.trim()}.</p>
      ) : null}
    </label>
  );
}