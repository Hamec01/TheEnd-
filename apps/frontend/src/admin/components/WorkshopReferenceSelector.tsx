import { useMemo, useState } from "react";
import type { ProfessionWorkshopDefinition } from "../../services/content/models";

interface WorkshopReferenceSelectorProps {
  label: string;
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  workshops: ProfessionWorkshopDefinition[];
  manualLabel?: string;
  manualPlaceholder?: string;
  addLabel?: string;
  searchPlaceholder?: string;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function parseWorkshopReferenceList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => normalize(entry))
    .filter(Boolean);
}

function buildWorkshopSearchText(workshop: ProfessionWorkshopDefinition): string {
  return [
    workshop.id,
    workshop.name,
    workshop.professionId,
    workshop.workshopKind,
    ...(workshop.tags ?? []),
  ]
    .map((entry) => normalize(entry).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function rankWorkshops(
  workshops: ProfessionWorkshopDefinition[],
  query: string,
  excludeIds: string[],
): ProfessionWorkshopDefinition[] {
  const normalizedQuery = normalize(query).toLowerCase();
  const excluded = new Set(excludeIds.map((entry) => normalize(entry)));
  const candidates = workshops.filter((workshop) => !excluded.has(normalize(workshop.id)));

  if (!normalizedQuery) {
    return candidates
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }

  return candidates
    .map((workshop) => {
      const id = normalize(workshop.id).toLowerCase();
      const name = normalize(workshop.name).toLowerCase();
      const professionId = normalize(workshop.professionId).toLowerCase();
      const workshopKind = normalize(workshop.workshopKind).toLowerCase();
      const tags = (workshop.tags ?? []).map((entry) => normalize(entry).toLowerCase());
      const haystack = buildWorkshopSearchText(workshop);

      let score = 0;
      if (id === normalizedQuery) score += 120;
      if (name === normalizedQuery) score += 110;
      if (professionId === normalizedQuery) score += 90;
      if (workshopKind === normalizedQuery) score += 80;
      if (id.startsWith(normalizedQuery)) score += 60;
      if (name.startsWith(normalizedQuery)) score += 55;
      if (professionId.startsWith(normalizedQuery)) score += 40;
      if (workshopKind.startsWith(normalizedQuery)) score += 35;
      if (tags.some((entry) => entry.startsWith(normalizedQuery))) score += 28;
      if (haystack.includes(normalizedQuery)) score += 20;

      return { workshop, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.workshop.name.localeCompare(right.workshop.name, "ru"))
    .slice(0, 8)
    .map((entry) => entry.workshop);
}

export function WorkshopReferenceSelector({
  label,
  selectedIds,
  onChange,
  workshops,
  manualLabel = "Ручной ввод Workshop IDs",
  manualPlaceholder = "workshop_carpenter_basic_public\nworkshop_blacksmith_razugar",
  addLabel = "Добавить мастерскую",
  searchPlaceholder = "Начните вводить id, название, professionId или тег мастерской",
}: WorkshopReferenceSelectorProps) {
  const [query, setQuery] = useState("");
  const workshopById = useMemo(() => new Map(workshops.map((workshop) => [workshop.id, workshop])), [workshops]);
  const selectedEntries = useMemo(
    () => selectedIds.map((id) => ({ id, workshop: workshopById.get(id) ?? null })),
    [selectedIds, workshopById],
  );
  const suggestions = useMemo(
    () => rankWorkshops(workshops, query, selectedIds),
    [query, selectedIds, workshops],
  );

  function commitIds(nextIds: string[]): void {
    onChange(Array.from(new Set(nextIds.map((entry) => normalize(entry)).filter(Boolean))));
  }

  function addWorkshopId(workshopId: string): void {
    const normalizedId = normalize(workshopId);
    if (!normalizedId) {
      return;
    }
    commitIds([...selectedIds, normalizedId]);
    setQuery("");
  }

  function removeWorkshopId(workshopId: string): void {
    commitIds(selectedIds.filter((entry) => normalize(entry) !== normalize(workshopId)));
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
          Выберите одну или несколько мастерских из `professionWorkshops` или введите ID вручную.
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
          {suggestions.map((workshop) => (
            <button
              key={workshop.id}
              type="button"
              className="action-btn-lw secondary"
              style={{
                width: "100%",
                textAlign: "left",
                justifyContent: "flex-start",
                display: "grid",
                gap: "0.15rem",
              }}
              onClick={() => addWorkshopId(workshop.id)}
            >
              <strong>{workshop.name || workshop.id}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {workshop.id}
              </span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {`professionId: ${workshop.professionId || "—"} • tier: ${typeof workshop.tier === "number" ? workshop.tier : "—"} • kind: ${workshop.workshopKind || "—"}`}
              </span>
            </button>
          ))}
          {suggestions.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Подходящие мастерские не найдены.
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.45rem" }}>
        <span>Выбранные мастерские</span>
        {selectedEntries.length > 0 ? (
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {selectedEntries.map(({ id, workshop }) => (
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
                  background: workshop ? "rgba(34, 49, 32, 0.28)" : "rgba(70, 40, 40, 0.25)",
                }}
              >
                <div style={{ display: "grid", gap: "0.15rem" }}>
                  <strong>{workshop?.name ?? `Мастерская не найдена: ${id}`}</strong>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {workshop ? workshop.id : id}
                  </span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {workshop
                      ? `professionId: ${workshop.professionId || "—"} • tier: ${typeof workshop.tier === "number" ? workshop.tier : "—"} • kind: ${workshop.workshopKind || "—"}`
                      : "Ссылка сохранится как ID и не будет удалена автоматически."}
                  </span>
                </div>
                <button
                  type="button"
                  className="action-btn-lw danger"
                  onClick={() => removeWorkshopId(id)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>Мастерские пока не выбраны.</p>
        )}
      </div>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>{manualLabel}</span>
        <textarea
          rows={Math.max(3, Math.min(8, selectedIds.length + 1))}
          value={selectedIds.join("\n")}
          onChange={(event) => commitIds(parseWorkshopReferenceList(event.target.value))}
          placeholder={manualPlaceholder}
        />
      </label>
    </div>
  );
}
