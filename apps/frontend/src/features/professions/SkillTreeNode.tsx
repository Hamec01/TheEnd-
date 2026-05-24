import React from 'react';

export type SkillTreeNodeVisualState = 'learned' | 'available' | 'locked' | 'blocked';

export const MINING_SKILL_NODE_WIDTH = 64;
export const MINING_SKILL_NODE_HEIGHT = 76;
export const MINING_BRANCH_NODE_WIDTH = 154;
export const MINING_BRANCH_NODE_HEIGHT = 196;

interface SkillTreeNodeProps {
  id: string;
  name: string;
  icon?: string;
  x: number;
  y: number;
  isBranch?: boolean;
  visualState: SkillTreeNodeVisualState;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function resolveNodeStyles(state: SkillTreeNodeVisualState, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    border: '1px solid rgba(168, 134, 84, 0.52)',
    boxShadow: '0 0 0 1px rgba(27, 19, 12, 0.85) inset',
    filter: 'none',
    opacity: 1,
  };

  if (state === 'learned') {
    base.border = '1px solid rgba(248, 201, 116, 0.98)';
    base.boxShadow = '0 0 0 1px rgba(53, 36, 18, 0.98) inset, 0 0 24px rgba(246, 197, 116, 0.5), 0 0 50px rgba(246, 197, 116, 0.18)';
  } else if (state === 'available') {
    base.border = '1px solid rgba(239, 183, 92, 0.92)';
    base.boxShadow = '0 0 0 1px rgba(51, 35, 18, 0.95) inset, 0 0 14px rgba(239, 183, 92, 0.36)';
  } else if (state === 'blocked') {
    base.border = '1px solid rgba(103, 78, 49, 0.7)';
    base.filter = 'grayscale(0.55) brightness(0.72)';
    base.opacity = 0.82;
  } else {
    base.border = '1px solid rgba(104, 89, 71, 0.65)';
    base.filter = 'grayscale(0.25) brightness(0.9)';
    base.opacity = 0.94;
  }

  if (selected) {
    base.boxShadow = `${base.boxShadow ?? ''}, 0 0 0 2px rgba(255, 223, 156, 0.92), 0 0 26px rgba(247, 205, 122, 0.38)`;
  }

  return base;
}

export function SkillTreeNode(props: SkillTreeNodeProps) {
  const { id, name, icon, x, y, isBranch = false, visualState, isSelected, onSelect } = props;
  const width = isBranch ? MINING_BRANCH_NODE_WIDTH : MINING_SKILL_NODE_WIDTH;
  const height = isBranch ? MINING_BRANCH_NODE_HEIGHT : MINING_SKILL_NODE_HEIGHT;
  const nodeStyles = resolveNodeStyles(visualState, isSelected);

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      title={name}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: isBranch ? 16 : 10,
        background: 'rgba(14, 10, 8, 0.92)',
        color: '#f4e6cb',
        padding: 3,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, filter 120ms ease',
        ...nodeStyles,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: isBranch ? 16 : 8,
          border: '1px solid rgba(242, 194, 106, 0.24)',
          pointerEvents: 'none',
        }}
      />
      {icon ? (
        <img
          src={icon}
          alt={name}
          style={{
            width: width - 8,
            height: height - 8,
            objectFit: 'cover',
            borderRadius: isBranch ? 12 : 8,
          }}
        />
      ) : (
        <span style={{ fontSize: isBranch ? 24 : 18, fontWeight: 700 }}>{isBranch ? '⚚' : '✦'}</span>
      )}
      <span
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: visualState === 'learned'
            ? '#f7ca72'
            : visualState === 'available'
              ? '#b9d0a0'
              : visualState === 'blocked'
                ? '#6a5750'
                : '#7c766a',
          boxShadow: visualState === 'learned' ? '0 0 10px rgba(247, 202, 114, 0.85)' : 'none',
        }}
      />
      {visualState === 'blocked' ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(8, 8, 8, 0.45)',
            borderRadius: isBranch ? 16 : 10,
            fontSize: 18,
          }}
        >
          🔒
        </span>
      ) : null}
    </button>
  );
}
