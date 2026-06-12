import { useMemo, useState } from "react";
import type { City } from "../../types/city";
import type { WorldLocation } from "../../types/location";
import type { NpcDefinition } from "../../types/npc";
import type { WorldMapZone } from "../../worldmap/zoneEditorTypes";
import {
  parseNpcReferenceList,
  rankNpcReferences,
  type NpcReferenceContext,
} from "../utils/npcReferenceSearch";

interface NpcReferenceSelectorProps {
  label: string;
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  npcs: NpcDefinition[];
  cities: City[];
  locations: WorldLocation[];
  zones: WorldMapZone[];
  context?: NpcReferenceContext | null;
  extraContexts?: NpcReferenceContext[];
  single?: boolean;
  manualLabel?: string;
  manualPlaceholder?: string;
  addLabel?: string;
  searchPlaceholder?: string;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function NpcReferenceSelector({
  label,
  selectedIds,
  onChange,
  npcs,
  cities,
  locations,
  zones,
  context,
  extraContexts = [],
  single = false,
  manualLabel = "Ручной ввод NPC IDs",
  manualPlaceholder = "npc_id_one\nnpc_id_two",
  addLabel = "Добавить NPC",
  searchPlaceholder = "Начните вводить id, имя или титул NPC",
}: NpcReferenceSelectorProps) {
  const [query, setQuery] = useState("");
  const npcById = useMemo(() => new Map(npcs.map((npc) => [npc.id, npc])), [npcs]);
  const selectedEntries = useMemo(
    () => selectedIds.map((id) => ({ id, npc: npcById.get(id) ?? null })),
    [npcById, selectedIds],
  );

  const suggestions = useMemo(() => rankNpcReferences({
    npcs,
    query,
    context,
    extraContexts,
    excludeIds: single ? [] : selectedIds,
    limit: 8,
    sources: { cities, locations, zones },
  }), [cities, context, extraContexts, locations, npcs, query, selectedIds, single, zones]);

  const manualValue = selectedIds.join("\n");

  function commitIds(nextIds: string[]): void {
    const unique = Array.from(new Set(nextIds.map((entry) => normalize(entry)).filter(Boolean)));
    onChange(single ? unique.slice(0, 1) : unique);
  }

  function addNpcId(npcId: string): void {
    const normalizedId = normalize(npcId);
    if (!normalizedId) {
      return;
    }
    commitIds(single ? [normalizedId] : [...selectedIds, normalizedId]);
    setQuery("");
  }

  function removeNpcId(npcId: string): void {
    commitIds(selectedIds.filter((entry) => normalize(entry) !== normalize(npcId)));
  }

  return (
    <div
      className="admin-stack"
      style={{
        gap: "0.7rem",
        padding: "0.8rem",
        border: "1px solid rgba(169,139,87,0.2)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <strong>{label}</strong>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {single ? "Выберите одного NPC или введите ID вручную." : "Выберите одного или нескольких NPC или введите ID вручную."}
        </span>
      </div>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>{addLabel}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          {suggestions.map((entry) => (
            <button
              key={entry.npc.id}
              type="button"
              className="action-btn-lw secondary"
              style={{
                width: "100%",
                textAlign: "left",
                justifyContent: "flex-start",
                display: "grid",
                gap: "0.15rem",
              }}
              onClick={() => addNpcId(entry.npc.id)}
            >
              <strong>{entry.summary.titleLine}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>{entry.detailLine}</span>
            </button>
          ))}
          {suggestions.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Подходящие NPC не найдены.
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        <span>Выбранные NPC</span>
        {selectedEntries.length > 0 ? (
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {selectedEntries.map(({ id, npc }) => (
              <div
                key={id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.8rem",
                  alignItems: "flex-start",
                  padding: "0.6rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid rgba(169,139,87,0.2)",
                  background: npc ? "rgba(34, 49, 32, 0.28)" : "rgba(70, 40, 40, 0.25)",
                }}
              >
                <div style={{ display: "grid", gap: "0.15rem" }}>
                  <strong>{npc?.name ?? `NPC не найден: ${id}`}</strong>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {npc ? `${npc.id}${npc.title?.trim() ? ` • ${npc.title.trim()}` : ""}` : id}
                  </span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {npc
                      ? [
                        npc.currentCityId?.trim() ? `currentCity: ${npc.currentCityId.trim()}` : "",
                        npc.cityLocationId?.trim() ? `cityLocation: ${npc.cityLocationId.trim()}` : "",
                        npc.locationId?.trim() ? `worldLocation: ${npc.locationId.trim()}` : "",
                      ].filter(Boolean).join(" • ") || "Место не задано"
                      : "Кнопка в runtime должна остаться disabled, пока NPC не появится в коллекции."}
                  </span>
                </div>
                <button
                  type="button"
                  className="action-btn-lw danger"
                  onClick={() => removeNpcId(id)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>NPC пока не выбраны.</p>
        )}
      </div>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>{manualLabel}</span>
        <textarea
          rows={Math.max(3, Math.min(8, selectedIds.length + 1))}
          value={manualValue}
          onChange={(event) => commitIds(parseNpcReferenceList(event.target.value))}
          placeholder={manualPlaceholder}
        />
      </label>
    </div>
  );
}

