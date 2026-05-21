export function fixMojibake(value: string | null | undefined): string {
  const input = String(value ?? '');
  if (!input) {
    return '';
  }
  if (!/[ÐÑ]/.test(input)) {
    return input;
  }
  try {
    const bytes = Uint8Array.from(Array.from(input).map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return input;
  }
}
