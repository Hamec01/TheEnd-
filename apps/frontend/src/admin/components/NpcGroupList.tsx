import { useEffect, useState } from 'react';
import type { NpcDefinition } from '../../types/npc';
import type { StoredImage } from '../../services/content/models';
import { resolveAdminImageSource, getAdminInitials, getNpcPreviewImageKey } from '../adminVisuals';
import { buildNpcCardSummary, type NpcGroupNode, type NpcGroupingContext } from '../utils/npcGrouping';

interface NpcGroupListProps {
  groups: NpcGroupNode[];
  selectedId: string | null;
  storedImages: StoredImage[];
  groupingContext: NpcGroupingContext;
  onSelect: (npc: NpcDefinition) => void;
}

export function NpcGroupList({ groups, selectedId, storedImages, groupingContext, onSelect }: NpcGroupListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // По умолчанию раскрываем группы с выбранным NPC или первые 3
    const defaultExpanded = new Set<string>();
    let count = 0;
    for (const group of groups) {
      const hasSelected = group.npcs.some((entry) => entry.id === selectedId)
        || group.children?.some((child) => child.npcs.some((entry) => entry.id === selectedId));
      if (hasSelected) {
        defaultExpanded.add(group.id);
        group.children?.forEach((child) => {
          if (child.npcs.some((entry) => entry.id === selectedId)) {
            defaultExpanded.add(child.id);
          }
        });
      } else if (count < 3) {
        defaultExpanded.add(group.id);
        count += 1;
      }
    }
    return defaultExpanded;
  });

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  useEffect(() => {
    const nextExpanded = new Set<string>();
    let count = 0;
    for (const group of groups) {
      const hasSelectedInSelf = group.npcs.some((entry) => entry.id === selectedId);
      const selectedChild = group.children?.find((child) => child.npcs.some((entry) => entry.id === selectedId)) ?? null;
      if (hasSelectedInSelf || selectedChild) {
        nextExpanded.add(group.id);
        if (selectedChild) {
          nextExpanded.add(selectedChild.id);
        }
        continue;
      }
      if (count < 3) {
        nextExpanded.add(group.id);
        count += 1;
      }
    }
    setExpandedGroups(nextExpanded);
  }, [groups, selectedId]);

  async function copyNpcId(npcId: string) {
    try {
      await navigator.clipboard.writeText(npcId);
    } catch {
      // ignore clipboard errors in unsupported contexts
    }
  }

  function renderNpcRow(npc: NpcDefinition) {
    const imageSrc = resolveAdminImageSource(getNpcPreviewImageKey(npc), storedImages);
    const summary = buildNpcCardSummary(npc, groupingContext);
    return (
      <div
        key={npc.id}
        className={`npc-group-item ${selectedId === npc.id ? 'is-active' : ''}`}
        onClick={() => onSelect(npc)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(npc);
          }
        }}
        role="button"
        tabIndex={0}
        title={summary.tooltip}
      >
        <span className="admin-catalog-thumb npc-group-item-thumb">
          {imageSrc ? (
            <img src={imageSrc} alt={npc.name || npc.id} />
          ) : (
            getAdminInitials(npc.name || npc.id, 'NPC')
          )}
        </span>
        <span className="npc-group-item-copy">
          <strong className="npc-group-item-name">{summary.titleLine}</strong>
          <span className="npc-group-item-meta">{summary.metaLine}</span>
          {summary.placeLine ? <span className="npc-group-item-place">{summary.placeLine}</span> : null}
        </span>
        <span className="npc-group-item-actions">
          <span className={`npc-group-item-status is-${npc.status}`}>{npc.status}</span>
          <span className="npc-group-item-id" aria-hidden="true">{npc.id}</span>
          <button
            type="button"
            className="npc-group-copy-btn"
            onClick={(event) => {
              event.stopPropagation();
              void copyNpcId(npc.id);
            }}
            title={`Скопировать ID: ${npc.id}`}
          >
            ID
          </button>
        </span>
      </div>
    );
  }

  function renderGroup(group: NpcGroupNode, depth = 0) {
    const isExpanded = expandedGroups.has(group.id);
    const totalCount = group.npcs.length + (group.children?.reduce((sum, child) => sum + child.npcs.length, 0) ?? 0);
    const hasChildren = Boolean(group.children?.length);

    return (
      <div key={group.id} className={`npc-group ${depth > 0 ? 'is-nested' : ''}`}>
        <button
          className={`npc-group-header ${isExpanded ? 'is-expanded' : ''} ${depth > 0 ? 'is-nested' : ''}`}
          onClick={() => toggleGroup(group.id)}
        >
          <span className="npc-group-toggle">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="npc-group-title">{group.label}</span>
          <span className="npc-group-count">({totalCount})</span>
        </button>

        {isExpanded && (
          <div className={`npc-group-items ${depth > 0 ? 'is-nested' : ''}`}>
            {group.npcs.map(renderNpcRow)}
            {hasChildren ? group.children!.map((child) => renderGroup(child, depth + 1)) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="npc-group-list">
      {groups.map((group) => renderGroup(group))}
    </div>
  );
}
