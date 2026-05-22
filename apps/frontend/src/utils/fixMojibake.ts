export function fixMojibake(value: string | null | undefined): string {
  const input = String(value ?? '');
  if (!input) {
    return '';
  }
  if (!looksLikeMojibake(input)) {
    return input;
  }

  const candidates = [
    decodeLatin1AsUtf8(input),
    decodeWindows1251AsUtf8(input),
  ].filter((candidate): candidate is string => Boolean(candidate));

  let best = input;
  let bestScore = scoreDecodedText(input);
  for (const candidate of candidates) {
    const score = scoreDecodedText(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function looksLikeMojibake(input: string): boolean {
  return /[ÐÑ]/.test(input)
    || /[ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџ]/.test(input)
    || /Р[ђѓєѕўџ“”‘’]/.test(input);
}

function decodeLatin1AsUtf8(input: string): string | null {
  try {
    const bytes = Uint8Array.from(Array.from(input).map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function decodeWindows1251AsUtf8(input: string): string | null {
  const bytes: number[] = [];
  for (const char of input) {
    const byte = getWindows1251Byte(char);
    if (byte === null) {
      return null;
    }
    bytes.push(byte);
  }

  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function getWindows1251Byte(char: string): number | null {
  const code = char.charCodeAt(0);
  if (code <= 0x7f) {
    return code;
  }
  if (code >= 0x0410 && code <= 0x044f) {
    return code - 0x0350;
  }

  const special: Record<number, number> = {
    0x0402: 0x80, 0x0403: 0x81, 0x201a: 0x82, 0x0453: 0x83,
    0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x20ac: 0x88, 0x2030: 0x89, 0x0409: 0x8a, 0x2039: 0x8b,
    0x040a: 0x8c, 0x040c: 0x8d, 0x040b: 0x8e, 0x040f: 0x8f,
    0x0452: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x2122: 0x99, 0x0459: 0x9a, 0x203a: 0x9b, 0x045a: 0x9c,
    0x045c: 0x9d, 0x045b: 0x9e, 0x045f: 0x9f, 0x00a0: 0xa0,
    0x040e: 0xa1, 0x045e: 0xa2, 0x0408: 0xa3, 0x00a4: 0xa4,
    0x0490: 0xa5, 0x00a6: 0xa6, 0x00a7: 0xa7, 0x0401: 0xa8,
    0x00a9: 0xa9, 0x0404: 0xaa, 0x00ab: 0xab, 0x00ac: 0xac,
    0x00ad: 0xad, 0x00ae: 0xae, 0x0407: 0xaf, 0x00b0: 0xb0,
    0x00b1: 0xb1, 0x0406: 0xb2, 0x0456: 0xb3, 0x0491: 0xb4,
    0x00b5: 0xb5, 0x00b6: 0xb6, 0x00b7: 0xb7, 0x0451: 0xb8,
    0x2116: 0xb9, 0x0454: 0xba, 0x00bb: 0xbb, 0x0458: 0xbc,
    0x0405: 0xbd, 0x0455: 0xbe, 0x0457: 0xbf,
  };

  if (code >= 0x00a0 && code <= 0x00bf) {
    return code;
  }
  return special[code] ?? null;
}

function scoreDecodedText(input: string): number {
  const cyrillic = countMatches(input, /[А-Яа-яЁё]/g);
  const replacement = countMatches(input, /�/g);
  const latinMojibake = countMatches(input, /[ÐÑ]/g);
  const cp1251Mojibake = countMatches(input, /[ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџ]/g);
  return cyrillic * 4 - replacement * 20 - latinMojibake * 8 - cp1251Mojibake * 8;
}

function countMatches(input: string, pattern: RegExp): number {
  return input.match(pattern)?.length ?? 0;
}
