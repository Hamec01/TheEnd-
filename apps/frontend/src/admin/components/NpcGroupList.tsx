import { useState } from 'react';
import type { NpcDefinition } from '../../types/npc';
import type { StoredImage } from '../../services/content/models';
import { resolveAdminImageSource, getAdminInitials, getNpcPreviewImageKey } from '../adminVisuals';

interface NpcGroupListProps {
  groups: Record<string, NpcDefinition[]>;
  selectedId: string | null;
  storedImages: StoredImage[];
  onSelect: (npc: NpcDefinition) => void;
}

export function NpcGroupList({ groups, selectedId, storedImages, onSelect }: NpcGroupListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // По умолчанию раскрываем группы с выбранным NPC или первые 3
    const defaultExpanded = new Set<string>();
    let count = 0;
    for (const [groupName, npcs] of Object.entries(groups)) {
      if (npcs.some((n) => n.id === selectedId)) {
        defaultExpanded.add(groupName);
      } else if (count < 3) {
        defaultExpanded.add(groupName);
        count += 1;
      }
    }
    return defaultExpanded;
  });

  function toggleGroup(groupName: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  return (
    <div className="npc-group-list">
      {Object.entries(groups).map(([groupName, npcs]) => {
        const isExpanded = expandedGroups.has(groupName);
        const totalCount = npcs.length;

        return (
          <div key={groupName} className="npc-group">
            <button
              className={`npc-group-header ${isExpanded ? 'is-expanded' : ''}`}
              onClick={() => toggleGroup(groupName)}
            >
              <span className="npc-group-toggle">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="npc-group-title">{groupName}</span>
              <span className="npc-group-count">({totalCount})</span>
            </button>

            {isExpanded && (
              <div className="npc-group-items">
                {npcs.map((npc) => {
                  const imageSrc = resolveAdminImageSource(getNpcPreviewImageKey(npc), storedImages);
                  return (
                    <button
                      key={npc.id}
                      className={`admin-entity-card ${selectedId === npc.id ? 'is-active' : ''}`}
                      onClick={() => onSelect(npc)}
                    >
                      <span className="admin-catalog-thumb">
                        {imageSrc ? (
                          <img src={imageSrc} alt={npc.name || npc.id} />
                        ) : (
                          getAdminInitials(npc.name || npc.id, 'NPC')
                        )}
                      </span>
                      <span className="admin-entity-copy">
                        <strong>{npc.name || '(без названия)'}</strong>
                        <span>{npc.id}</span>
                        <span>{npc.kind} | {npc.status}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
