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

const imageDataUrlCache = new Map<string, string>();
const imageDataUrlPending = new Map<string, Promise<string>>();

async function resolveImageDataUrl(imageId: string): Promise<string> {
  const normalizedId = imageId.trim();
  if (!normalizedId) {
    return '';
  }

  const cached = imageDataUrlCache.get(normalizedId);
  if (cached !== undefined) {
    return cached;
  }

  const pending = imageDataUrlPending.get(normalizedId);
  if (pending) {
    return pending;
  }

  const request = imageService
    .get(normalizedId)
    .then((entry) => {
      const dataUrl = entry?.dataUrl ?? '';
      imageDataUrlCache.set(normalizedId, dataUrl);
      return dataUrl;
    })
    .catch(() => '')
    .finally(() => {
      imageDataUrlPending.delete(normalizedId);
    });

  imageDataUrlPending.set(normalizedId, request);
  return request;
}

export interface GameImageViewProps {
  imageRef?: GameImageRef | null;
  legacyImagePath?: string | null;
  runtimeImages?: StoredImage[];
  alt: string;
  className?: string;
  size?: number;
  fallbackText?: string;
  fit?: 'cover' | 'contain';
}

export function GameImageView({
  imageRef,
  legacyImagePath,
  runtimeImages = [],
  alt,
  className,
  size = 72,
  fallbackText = '?',
  fit = 'cover',
}: GameImageViewProps) {
  function isDirectImageSource(valueToCheck: string): boolean {
    return valueToCheck.startsWith('data:') || valueToCheck.startsWith('/') || valueToCheck.startsWith('http://') || valueToCheck.startsWith('https://');
  }

  function isBrokenPlaceholderSource(valueToCheck: string): boolean {
    const probe = valueToCheck.trim().toLowerCase();
    if (!probe) {
      return true;
    }
    return probe === 'unknown'
      || probe === '/unknown'
      || probe.includes('unknown_placeholder')
      || probe.endsWith('/unknown.png')
      || probe.endsWith('/unknown.jpg')
      || probe.endsWith('/unknown.jpeg');
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
          const dataUrl = await resolveImageDataUrl(imageId);
          if (!cancelled) {
            setFallbackSrc(dataUrl);
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

        const dataUrl = await resolveImageDataUrl(imageId);
        if (!cancelled) {
          setFallbackSrc(dataUrl);
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

  const directSrc = (baseResolvedSrc && isDirectImageSource(baseResolvedSrc) && !isBrokenPlaceholderSource(baseResolvedSrc))
    ? baseResolvedSrc
    : '';
  const safeFallbackSrc = !isBrokenPlaceholderSource(fallbackSrc) ? fallbackSrc : '';
  const src = directSrc || safeFallbackSrc;

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
        style={{ ...baseStyle, objectFit: fit }}
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
