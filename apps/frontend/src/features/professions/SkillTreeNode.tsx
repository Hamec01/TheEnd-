import React from 'react';

export type SkillTreeNodeVisualState = 'learned' | 'available' | 'locked' | 'blocked';

export const MINING_SKILL_NODE_WIDTH = 64;
export const MINING_SKILL_NODE_HEIGHT = 76;
export const MINING_BRANCH_NODE_WIDTH = 154;
export const MINING_BRANCH_NODE_HEIGHT = 196;
export const DEFAULT_SKILL_NODE_WIDTH = 190;
export const DEFAULT_SKILL_NODE_HEIGHT = 50;
export const DEFAULT_BRANCH_NODE_WIDTH = 232;
export const DEFAULT_BRANCH_NODE_HEIGHT = 58;

interface SkillTreeNodeProps {
  id: string;
  name: string;
  icon?: string;
  iconFrame?: {
    src: string;
    frameX: number;
    frameY: number;
    frameWidth: number;
    frameHeight: number;
    sheetWidth: number;
    sheetHeight: number;
  };
  x: number;
  y: number;
  width?: number;
  height?: number;
  isBranch?: boolean;
  visualState: SkillTreeNodeVisualState;
  isSelected: boolean;
  showName?: boolean;
  grayUntilLearned?: boolean;
  slotMode?: boolean;
  isWoodlandTheme?: boolean;
  onSelect: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

function resolveNodeStyles(
  state: SkillTreeNodeVisualState,
  selected: boolean,
  grayUntilLearned: boolean,
  isWoodlandTheme?: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    border: '1px solid rgba(168, 134, 84, 0.52)',
    boxShadow: '0 0 0 1px rgba(27, 19, 12, 0.85) inset',
    filter: 'none',
    opacity: 1,
  };

  if (isWoodlandTheme) {
    base.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.72), inset 0 0 0 1px rgba(35, 24, 15, 0.85)';
    base.border = '1px solid rgba(168, 134, 84, 0.42)';
    if (state === 'learned') {
      base.border = '1px solid rgba(250, 185, 90, 0.98)';
      base.boxShadow = '0 0 28px rgba(250, 185, 90, 0.45), 0 8px 24px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(53, 36, 18, 0.98)';
    } else if (state === 'available') {
      base.border = '1px solid rgba(224, 148, 66, 0.92)';
      base.boxShadow = '0 0 18px rgba(224, 148, 66, 0.32), 0 6px 16px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(51, 35, 18, 0.95)';
    } else if (state === 'blocked') {
      base.border = '1px solid rgba(103, 78, 49, 0.6)';
      base.filter = 'grayscale(0.65) brightness(0.68)';
      base.opacity = 0.78;
    } else {
      base.border = '1px solid rgba(120, 100, 80, 0.5)';
      base.filter = 'grayscale(0.3) brightness(0.8)';
    }
  } else {
    if (state === 'learned') {
      base.border = '1px solid rgba(248, 201, 116, 0.98)';
      base.boxShadow = '0 0 0 1px rgba(53, 36, 18, 0.98) inset, 0 0 24px rgba(246, 197, 116, 0.5), 0 0 50px rgba(246, 197, 116, 0.18)';
    } else if (grayUntilLearned) {
      base.border = '1px solid rgba(116, 111, 103, 0.74)';
      base.boxShadow = '0 0 0 1px rgba(40, 38, 34, 0.9) inset';
      base.filter = state === 'blocked' ? 'grayscale(0.9) brightness(0.62)' : 'grayscale(0.82) brightness(0.78)';
      base.opacity = state === 'blocked' ? 0.78 : 0.9;
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
  }

  if (selected) {
    base.boxShadow = `${base.boxShadow ?? ''}, 0 0 0 2px rgba(255, 223, 156, 0.92), 0 0 26px rgba(247, 205, 122, 0.38)`;
  }

  return base;
}

export function SkillTreeNode(props: SkillTreeNodeProps) {
  const {
    id,
    name,
    icon,
    iconFrame,
    x,
    y,
    width,
    height,
    isBranch = false,
    visualState,
    isSelected,
    showName = false,
    grayUntilLearned = false,
    slotMode = false,
    isWoodlandTheme = false,
    onSelect,
  } = props;
  const nodeWidth = width ?? (isBranch ? MINING_BRANCH_NODE_WIDTH : MINING_SKILL_NODE_WIDTH);
  const nodeHeight = height ?? (isBranch ? MINING_BRANCH_NODE_HEIGHT : MINING_SKILL_NODE_HEIGHT);
  const nodeStyles = resolveNodeStyles(visualState, isSelected, grayUntilLearned, isWoodlandTheme);
  const iconSize = showName ? 24 : nodeWidth - 8;
  const hasVisualIcon = Boolean(iconFrame?.src || icon);

  return (
    <button
      type="button"
      className="skill-node-btn"
      onClick={(event) => onSelect(id, event)}
      title={name}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: slotMode ? 4 : (isBranch ? 16 : 10),
        background: slotMode ? 'transparent' : (isWoodlandTheme ? 'rgba(24, 18, 14, 0.92)' : 'rgba(14, 10, 8, 0.92)'),
        backdropFilter: isWoodlandTheme ? 'blur(8px)' : 'none',
        color: '#f4e6cb',
        padding: slotMode ? 0 : 3,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, filter 120ms ease',
        ...(slotMode ? {
          border: 'none',
          boxShadow: isSelected ? '0 0 0 1px rgba(255, 223, 156, 0.82), 0 0 12px rgba(247, 205, 122, 0.24)' : 'none',
          filter: nodeStyles.filter,
          opacity: nodeStyles.opacity,
        } : nodeStyles),
      }}
    >
      {!slotMode ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: isBranch ? 16 : 8,
            border: '1px solid rgba(242, 194, 106, 0.24)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {iconFrame?.src ? (
        <span
          aria-hidden="true"
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: isBranch ? 12 : 8,
            position: showName ? 'absolute' : 'static',
            left: showName ? 8 : undefined,
            top: showName ? (nodeHeight - iconSize) / 2 : undefined,
            backgroundImage: `url(${iconFrame.src})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `-${iconFrame.frameX * (iconSize / Math.max(1, iconFrame.frameWidth))}px -${iconFrame.frameY * (iconSize / Math.max(1, iconFrame.frameHeight))}px`,
            backgroundSize: `${iconFrame.sheetWidth * (iconSize / Math.max(1, iconFrame.frameWidth))}px ${iconFrame.sheetHeight * (iconSize / Math.max(1, iconFrame.frameHeight))}px`,
            imageRendering: 'pixelated',
          }}
        />
      ) : icon ? (
        <img
          src={icon}
          alt={name}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: 'cover',
            borderRadius: isBranch ? 12 : 8,
            position: showName ? 'absolute' : 'static',
            left: showName ? 8 : undefined,
            top: showName ? (nodeHeight - iconSize) / 2 : undefined,
          }}
        />
      ) : (
        <span style={{ fontSize: showName ? 14 : (isBranch ? 24 : 18), fontWeight: 700, position: showName ? 'absolute' : 'static', left: showName ? 12 : undefined, top: showName ? (nodeHeight - 16) / 2 : undefined }}>{isBranch ? '⚚' : '✦'}</span>
      )}
      {showName ? (
        <span
          style={{
            position: 'absolute',
            left: hasVisualIcon ? 40 : 28,
            right: 10,
            top: 7,
            bottom: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textAlign: 'left',
            lineHeight: 1.1,
            fontSize: isBranch ? 14 : 13,
            fontWeight: isBranch ? 800 : 700,
            color: visualState === 'learned' ? '#f6e3bf' : '#d0cdc8',
            textShadow: '0 1px 1px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
          }}
        >
          {name}
        </span>
      ) : null}
      {!slotMode ? (
        <>
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
        </>
      ) : null}
    </button>
  );
}
