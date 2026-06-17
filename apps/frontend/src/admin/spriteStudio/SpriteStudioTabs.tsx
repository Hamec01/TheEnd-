import type { SpriteStudioTab } from './types';

const TAB_OPTIONS: Array<{ id: SpriteStudioTab; label: string }> = [
  { id: 'control', label: 'Control' },
  { id: 'playground', label: 'Playground' },
  { id: 'itemForge', label: 'Visual Forge' },
  { id: 'bindings', label: 'Bindings' },
];

interface SpriteStudioTabsProps {
  activeTab: SpriteStudioTab;
  onChange: (tab: SpriteStudioTab) => void;
}

export function SpriteStudioTabs({ activeTab, onChange }: SpriteStudioTabsProps) {
  return (
    <div className="admin-actions-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
      {TAB_OPTIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

