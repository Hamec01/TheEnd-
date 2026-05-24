function slugSegment(value: string): string {
  return value
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

export function buildUploadFolder(...parts: Array<string | null | undefined>): string | undefined {
  const normalized = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .map(slugSegment)
    .filter(Boolean)
    .slice(0, 10);

  return normalized.length > 0 ? normalized.join('/') : undefined;
}
