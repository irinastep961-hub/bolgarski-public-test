/** Приводит текст к виду для сравнения: регистр, ё/е, пунктуация, пробелы. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"«»„“”'’()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameText(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Перемешивание, одинаковое при одинаковом seed (нет расхождений сервер/клиент). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const a = [...items];
  const rand = rng(hash(seed));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
