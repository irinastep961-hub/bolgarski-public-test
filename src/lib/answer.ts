// Проверка ответов: единые правила для ввода текста и сборки фраз.
// Принимаются только варианты из заранее составленного списка (ничего «на глаз»),
// а при ошибке пользователь получает объяснение по-русски.
import type { Trap } from '../types';
import { normalize } from './text';

export interface Verdict {
  correct: boolean;
  /** Пояснение по-русски: что не так (или мелкое замечание к верному ответу) */
  message?: string;
}

export interface CheckOptions {
  lang: 'bg' | 'ru';
  traps?: Trap[];
  /** Замечать регистр букв (заглавные в начале фразы и в именах). */
  remarkCase?: boolean;
}

const PUNCT = /[.,!?;:"«»„“”'’()\-–—…]/g;

/** Слова фразы без знаков препинания, с сохранением регистра */
export function words(s: string): string[] {
  return s.replace(PUNCT, ' ').split(/\s+/).filter(Boolean);
}

/** Слова фразы в нормализованном виде (нижний регистр, ё→е) */
export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function sharedPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function quote(list: string[]): string {
  return list.slice(0, 3).map((w) => `«${w}»`).join(', ');
}

export function matchesTrap(norm: string, t: Trap): boolean {
  const padded = ` ${norm} `;
  if (t.starts && padded.startsWith(` ${normalize(t.starts)} `)) return true;
  if (t.has && padded.includes(` ${normalize(t.has)} `)) return true;
  return false;
}

function caseRemark(input: string, matched: string): string | undefined {
  const a = words(input);
  const b = words(matched);
  const missing: string[] = [];
  let first = false;
  b.forEach((w, i) => {
    const typed = a[i];
    if (typed !== undefined && typed !== w && typed.toLowerCase() === w.toLowerCase() && /^\p{Lu}/u.test(w) && !/^\p{Lu}/u.test(typed)) {
      if (i === 0) first = true;
      else missing.push(w);
    }
  });
  const parts: string[] = [];
  if (first) parts.push('Фраза начинается с заглавной буквы.');
  if (missing.length) parts.push(`Пишите с заглавной: ${quote(missing)}.`);
  return parts.length ? `Верно, но обратите внимание на регистр. ${parts.join(' ')}` : undefined;
}

/** Разбор ошибки: порядок слов, недостающие/лишние слова, опечатки, другая форма слова. */
function diagnose(input: string[], expected: string[]): string {
  if ([...input].sort().join('|') === [...expected].sort().join('|')) {
    return 'Все слова верные, но порядок слов другой. В болгарском порядок слов важен — проверьте, что за чем идёт.';
  }
  const rest = [...expected];
  const extra: string[] = [];
  for (const w of input) {
    const i = rest.indexOf(w);
    if (i >= 0) rest.splice(i, 1);
    else extra.push(w);
  }
  const missing = rest;
  const notes: string[] = [];
  const unpairedMissing = [...missing];
  const unpairedExtra: string[] = [];
  for (const e of extra) {
    let best = -1;
    let bestD = 99;
    unpairedMissing.forEach((m, i) => {
      const d = levenshtein(e, m);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      const m = unpairedMissing[best];
      if (bestD <= 2 && Math.max(e.length, m.length) >= 4) {
        notes.push(`Проверьте написание: «${e}» → «${m}».`);
        unpairedMissing.splice(best, 1);
      } else if (sharedPrefix(e, m) >= 3) {
        notes.push(`Нужна другая форма слова: вместо «${e}» — «${m}» (смотрите окончание или артикль).`);
        unpairedMissing.splice(best, 1);
      } else {
        unpairedExtra.push(e);
      }
    } else {
      unpairedExtra.push(e);
    }
  }
  if (unpairedExtra.length) notes.push(`Лишние слова: ${quote(unpairedExtra)}.`);
  if (unpairedMissing.length) notes.push(`Не хватает слов: ${quote(unpairedMissing)}.`);
  return notes.slice(0, 3).join(' ') || 'Ответ не совпал с ожидаемым. Сравните с правильным вариантом.';
}

/**
 * Проверяет ответ по списку допустимых вариантов.
 * Лишние пробелы, регистр и знаки препинания на правильность не влияют,
 * но замечание о регистре (заглавная в начале, имена) выводится как подсказка.
 */
export function checkText(input: string, accepted: string[], opts: CheckOptions): Verdict {
  if (!input.trim()) return { correct: false, message: 'Введите ответ.' };

  if (/[A-Za-z]/.test(input)) {
    return { correct: false, message: 'В ответе есть латинские буквы. Печатайте только кириллицей — переключите раскладку клавиатуры.' };
  }
  if (opts.lang === 'bg' && /[ыэёЫЭЁ]/.test(input)) {
    return { correct: false, message: 'В болгарском нет букв «ы», «э» и «ё». Вместо «ы» обычно пишут «и» или «ъ», вместо «э» — «е».' };
  }

  const norm = normalize(input);
  const hit = accepted.find((a) => normalize(a) === norm);
  if (hit) {
    const remark = opts.remarkCase === false || opts.lang !== 'bg' ? undefined : caseRemark(input, hit);
    return { correct: true, ...(remark ? { message: remark } : {}) };
  }

  for (const t of opts.traps ?? []) if (matchesTrap(norm, t)) return { correct: false, message: t.say };

  // ближайший допустимый вариант
  const inTok = tokens(input);
  let best = accepted[0];
  let bestD = Infinity;
  for (const a of accepted) {
    const d = levenshtein(norm, normalize(a));
    if (d < bestD) { bestD = d; best = a; }
  }
  return { correct: false, message: diagnose(inTok, tokens(best)) };
}

/** Сборка фразы: собранные слова сравниваются с основным и дополнительными вариантами. */
export function checkBuild(picked: string[], variants: string[][]): Verdict {
  return checkText(picked.join(' '), variants.map((v) => v.join(' ')), { lang: 'bg', remarkCase: false });
}
