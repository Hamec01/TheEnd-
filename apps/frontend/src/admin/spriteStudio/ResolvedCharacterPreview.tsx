import { useEffect, useRef } from 'react';
import { drawSpriteStudioPreview } from '../../sprite-studio-core';
import type { ImageSheetDefinition, StoredImage } from '../../services/content/models';
import type { ResolvedCharacterVisual } from '../../sprite-studio-core';

interface ResolvedCharacterPreviewProps {
  resolved: ResolvedCharacterVisual | null;
  runtimeImages: StoredImage[];
  imageSheets: ImageSheetDefinition[];
  className?: string;
  showDetails?: boolean;
  zoom?: number;
}

function renderIssueList(title: string, issues: ResolvedCharacterVisual['warnings']) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <div>
      <strong>{title}</strong>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {issues.map((issue) => (
          <li key={`${issue.code}:${issue.refId ?? issue.entityId ?? issue.message}`}>
            <code>{issue.code}</code>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResolvedCharacterPreview({
  resolved,
  runtimeImages,
  imageSheets,
  className,
  showDetails = true,
  zoom = 1,
}: ResolvedCharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!resolved || !canvasRef.current) {
      return;
    }
    void drawSpriteStudioPreview({
      canvas: canvasRef.current,
      resolved,
      runtimeImages,
      imageSheets,
    });
  }, [imageSheets, resolved, runtimeImages]);

  return (
    <section className={className ?? 'card admin-item-preview'} style={{ display: 'grid', gap: 16 }}>
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        style={{
          width: 256 * zoom,
          height: 256 * zoom,
          maxWidth: '100%',
          maxHeight: '100%',
          border: '1px solid rgba(215, 178, 103, 0.25)',
          borderRadius: 12,
          background: 'rgba(0, 0, 0, 0.3)',
          imageRendering: 'pixelated',
        }}
      />
      {resolved && showDetails ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p><strong>Profile source:</strong> {resolved.debug.profileSource}</p>
          <p><strong>Profile:</strong> {resolved.spriteProfileId || 'none'}</p>
          <p><strong>Body template:</strong> {resolved.bodyTemplateId || 'none'}</p>
          <p><strong>Animation set:</strong> {resolved.animationSetId || 'none'}</p>
          <p><strong>Resolved layers:</strong> {resolved.layers.length}</p>
          <p><strong>Chosen bindings:</strong> {resolved.debug.equipment.filter((entry) => entry.chosenBindingId).length}</p>
          {renderIssueList('Warnings', resolved.warnings)}
          {renderIssueList('Errors', resolved.errors)}
          <details>
            <summary>Resolver debug</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{JSON.stringify(resolved.debug, null, 2)}</pre>
          </details>
        </div>
      ) : !resolved ? (
        <p className="muted">No resolved preview available.</p>
      ) : null}
    </section>
  );
}
