import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameImageRef, StoredImage } from '../../services/content/models';
import {
  getImageSheet,
  getTilesetFrameRect,
  normalizeGameImageRef,
  resolveGameImageRefSource,
} from '../../services/content/gameImageRefs';
import { imageService } from '../../services/content/imageService';

export interface GameImageViewProps {
  imageRef?: GameImageRef | null;
  legacyImagePath?: string | null;
  runtimeImages?: StoredImage[];
  alt: string;
  className?: string;
  size?: number;
  fallbackText?: string;
}

export function GameImageView({
  imageRef,
  legacyImagePath,
  runtimeImages = [],
  alt,
  className,
  size = 72,
  fallbackText = '?',
}: GameImageViewProps) {
  function isDirectImageSource(valueToCheck: string): boolean {
    return valueToCheck.startsWith('data:') || valueToCheck.startsWith('/') || valueToCheck.startsWith('http://') || valueToCheck.startsWith('https://');
  }

  const normalized = useMemo(
    () => normalizeGameImageRef(imageRef, legacyImagePath),
    [imageRef, legacyImagePath],
  );

  const baseResolvedSrc = useMemo(
    () => resolveGameImageRefSource(normalized, runtimeImages),
    [normalized, runtimeImages],
  );
  const [fallbackSrc, setFallbackSrc] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    if (!normalized) {
      setFallbackSrc('');
      return undefined;
    }

    const resolved = String(baseResolvedSrc ?? '').trim();
    if (resolved && isDirectImageSource(resolved)) {
      setFallbackSrc('');
      return undefined;
    }

    const tryResolve = async () => {
      try {
        if (normalized.type === 'image') {
          const imageId = resolved || normalized.src;
          const fetched = await imageService.get(imageId);
          if (!cancelled) {
            setFallbackSrc(fetched?.dataUrl ?? '');
          }
          return;
        }

        const sheet = getImageSheet(normalized.sheetId);
        const imageId = resolved || sheet?.src?.trim() || '';
        if (!imageId || isDirectImageSource(imageId)) {
          if (!cancelled) {
            setFallbackSrc('');
          }
          return;
        }

        const fetched = await imageService.get(imageId);
        if (!cancelled) {
          setFallbackSrc(fetched?.dataUrl ?? '');
        }
      } catch {
        if (!cancelled) {
          setFallbackSrc('');
        }
      }
    };

    void tryResolve();

    return () => {
      cancelled = true;
    };
  }, [baseResolvedSrc, normalized]);

  const src = (baseResolvedSrc && isDirectImageSource(baseResolvedSrc)) ? baseResolvedSrc : (fallbackSrc || '');

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 10,
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#d7e2f7',
    fontWeight: 700,
    letterSpacing: '0.04em',
  };

  if (!normalized || !src) {
    return <div className={className} style={baseStyle} aria-label={alt}>{fallbackText}</div>;
  }

  if (normalized.type === 'image') {
    return (
      <img
        className={className}
        src={src}
        alt={alt}
        style={{ ...baseStyle, objectFit: 'cover' }}
      />
    );
  }

  const sheet = getImageSheet(normalized.sheetId);
  if (!sheet) {
    return <div className={className} style={baseStyle} aria-label={alt}>{fallbackText}</div>;
  }

  const frame = getTilesetFrameRect(sheet, normalized.frame);
  const scaleX = size / Math.max(1, sheet.frameWidth);
  const scaleY = size / Math.max(1, sheet.frameHeight);
  const frameStyle: CSSProperties = {
    ...baseStyle,
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'no-repeat',
    // Scale the sprite sheet down to the preview size so each cell shows the full frame
    // instead of just the top-left corner of a 128x128 tile.
    backgroundPosition: `-${frame.x * scaleX}px -${frame.y * scaleY}px`,
    backgroundSize: `${sheet.columns * sheet.frameWidth * scaleX}px ${sheet.rows * sheet.frameHeight * scaleY}px`,
    imageRendering: 'pixelated',
  };

  return <div className={className} style={frameStyle} role="img" aria-label={alt} />;
}
