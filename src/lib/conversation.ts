// Проверка ответов в разговорной практике.
//
// ЧЕСТНОЕ ОГРАНИЧЕНИЕ: приложение не «понимает» речь и не использует ИИ. Ответ сверяется с
// заранее подготовленными вариантами (шаблоны с {а|б|в}), поэтому верная фраза, которой нет
// в списке, может быть отмечена как «отличающаяся». Для будущей AI-проверки предусмотрен
// интерфейс ReplyChecker: достаточно подставить другую реализацию.
import type { ConversationTurn, ReplyLevel, Trap } from '../types';
import { checkText, levenshtein, matchesTrap, tokens, words } from './answer';
import { checkFree } from './freeform';
import { normalize } from './text';

export const MAX_VARIANTS = 400;

export const LIMITS_NOTE =
  'Приложение проверяет ответы по заранее подготовленным вариантам и не понимает любые фразы. Если ваша фраза верна, но её нет в списке, она может быть отмечена как отличающаяся.';

/** Раскрывает шаблон: {а|б|} — любой из вариантов (пустой допустим). Вложенность не поддерживается. */
export function expandTemplate(template: string): string[] {
  let acc = [''];
  for (const part of template.split(/(\{[^{}]*\})/)) {
    if (part.startsWith('{') && part.endsWith('}')) {
      const options = part.slice(1, -1).split('|');
      acc = acc.flatMap((a) => options.map((o) => a + o));
    } else {
      acc = acc.map((a) => a + part);
    }
    if (acc.length > MAX_VARIANTS) throw new Error(`Шаблон даёт больше ${MAX_VARIANTS} вариантов: ${template}`);
  }
  return acc;
}

/** Аккуратный вид фразы: пробелы, знаки препинания, заглавная буква, точка в конце. */
export function tidy(s: string): string {
  let t = s.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/^[\s,.!?]+/, '').replace(/,\s*([.!?])/g, '$1').trim();
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : t + '.';
}

/** Все допустимые варианты ответа (без повторов) */
export function variantsOf(turn: Pick<ConversationTurn, 'accepted' | 'natural'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...turn.accepted.flatMap(expandTemplate), turn.natural]) {
    const v = tidy(raw);
    const n = normalize(v);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(v);
    }
  }
  return out;
}

export interface ReplyVerdict {
  level: ReplyLevel | 'empty';
  /** Объяснение по-русски */
  message: string;
  /** Исправленный вариант на болгарском (ближайший допустимый) */
  corrected: string;
  /** Естественная фраза, которой пользуются болгары */
  natural: string;
  /** Ответ совпал с естественной фразой (или с одним из равноценных естественных ответов) */
  isNatural: boolean;
}

/** Контекст разговора: кто собеседник и на «вы» или на «ты» с ним говорят */
export interface ReplyContext {
  register?: 'formal' | 'informal';
  partner?: string;
}

export interface ReplyChecker {
  check(turn: ConversationTurn, input: string, ctx?: ReplyContext): ReplyVerdict | Promise<ReplyVerdict>;
}

// ------------------------------------------------------------ вежливость и роли

/** Убирает «моля» / «ако обичате» в начале и в конце фразы */
function splitPolite(variant: string): { core: string; polite: boolean } {
  const ws = words(variant);
  const low = ws.map((w) => w.toLowerCase());
  let a = 0;
  let b = ws.length;
  let polite = false;
  for (let changed = true; changed; ) {
    changed = false;
    if (b - a >= 2 && low[a] === 'моля') { a++; changed = polite = true; }
    if (b - a >= 2 && low[b - 1] === 'моля') { b--; changed = polite = true; }
    if (b - a >= 3 && low[b - 2] === 'ако' && low[b - 1] === 'обичате') { b -= 2; changed = polite = true; }
  }
  return { core: ws.slice(a, b).join(' '), polite };
}

/**
 * Если в сценарии вежливое «моля» входит в ответы, то в этой реплике оно необязательно:
 * «Кафе с мляко», «Моля, кафе с мляко», «Кафе с мляко, ако обичате» — все верны.
 */
export function politeForms(variants: string[]): string[] {
  if (!variants.some((v) => splitPolite(v).polite)) return [];
  const have = new Set(variants.map(normalize));
  const out: string[] = [];
  for (const v of variants) {
    const { core } = splitPolite(v);
    for (const f of [core, `${core} моля`, `моля ${core}`, `${core} ако обичате`]) {
      const n = normalize(f);
      if (n && !have.has(n)) {
        have.add(n);
        out.push(tidy(f));
      }
    }
  }
  return out;
}

/** Все ответы, которые засчитываются как верные */
export function acceptedForms(turn: Pick<ConversationTurn, 'accepted' | 'natural'>): string[] {
  const base = variantsOf(turn);
  return [...base, ...politeForms(base)];
}

/** Равноценные естественные ответы (для них подсказка «так говорят чаще» не нужна) */
function naturalSet(turn: ConversationTurn): Set<string> {
  const set = new Set<string>([normalize(turn.natural)]);
  for (const t of turn.alsoNatural ?? []) for (const v of expandTemplate(t)) set.add(normalize(tidy(v)));
  return set;
}

/** Типичные ошибки обращения: с незнакомым человеком говорят на «вы» */
export function registerTraps(ctx: ReplyContext = {}): Trap[] {
  if (ctx.register === 'informal') return [];
  const who = ctx.partner ? `Собеседник — ${ctx.partner.toLowerCase()}` : 'Собеседник — малознакомый человек';
  const you = (said: string, right: string): string => `${who}: с ним говорят на «вы». Вместо «${said}» нужно «${right}».`;
  return [
    { has: 'имаш', say: you('имаш', 'имате') },
    { has: 'можеш', say: you('можеш', 'можете') },
    { has: 'искаш', say: you('искаш', 'искате') },
    { has: 'знаеш', say: you('знаеш', 'знаете') },
    { has: 'ти', say: you('ти', 'вие') },
    { has: 'здравей', say: `${who}: «Здравей» — приветствие для друга. Незнакомому человеку говорят «Здравейте» или «Добър ден».` },
  ];
}

function closest(input: string, variants: string[]): { variant: string; ratio: number } {
  const n = normalize(input);
  let best = variants[0];
  let bestD = Infinity;
  for (const v of variants) {
    const d = levenshtein(n, normalize(v));
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return { variant: best, ratio: bestD / Math.max(n.length, normalize(best).length, 1) };
}

/** Пользователь повторил реплику собеседника (целиком или значительную её часть) */
export function isEcho(input: string, partnerLine: string): boolean {
  const a = tokens(input);
  const b = tokens(partnerLine);
  if (a.length === 0 || b.length === 0) return false;
  const na = a.join(' ');
  const nb = b.join(' ');
  if (levenshtein(na, nb) / Math.max(na.length, nb.length, 1) <= 0.12) return true;
  // «эхо» — это значительная часть реплики (не меньше половины слов), а не случайное совпадение двух слов
  const inside = (small: string[], big: string[]) =>
    small.length >= 2 && small.length / big.length >= 0.5 && big.some((_, i) => small.every((w, j) => big[i + j] === w));
  return inside(a, b) || inside(b, a);
}

const MSG_PERFECT = 'Отлично!';
const MSG_FREE = 'Правильно! Можно сказать и так.';
const badLettersIn = (s: string) => /[A-Za-zыэёЫЭЁ]/.test(s);

export function checkReply(turn: ConversationTurn, input: string, ctx: ReplyContext = {}): ReplyVerdict {
  const natural = tidy(turn.natural);
  const variants = variantsOf(turn);
  const base = { natural, corrected: natural };

  if (!input.trim()) {
    return { ...base, level: 'empty', message: 'Введите ответ или запишите его голосом.', isNatural: false };
  }

  const traps = [...(turn.traps ?? []), ...registerTraps(ctx)];
  const v = checkText(input, [...variants, ...politeForms(variants)], { lang: 'bg', traps });
  const norm = normalize(input);
  const isNatural = naturalSet(turn).has(norm);
  if (v.correct) {
    return { ...base, level: 'correct', message: v.message ?? MSG_PERFECT, isNatural };
  }

  const { variant, ratio } = closest(input, variants);
  const toks = tokens(input);

  // Пользователь повторил реплику собеседника вместо своего ответа
  if (isEcho(input, turn.them.bg)) {
    const who = ctx.partner ? ctx.partner.toLowerCase() : 'собеседник';
    return {
      ...base, level: 'off', corrected: variant, isNatural: false,
      message: `Это слова собеседника (${who}), а отвечаете вы. Повторять его реплику не нужно. Сейчас нужно: ${turn.task}`,
    };
  }

  // Свободный ответ: грамматически верная фраза вне шаблонов (другой порядок слов, лишние слова)
  if (turn.free && !traps.some((t) => matchesTrap(norm, t)) && !badLettersIn(input)) {
    const f = checkFree(turn.free, input);
    if (f.status === 'ok') {
      return { ...base, level: 'correct', message: MSG_FREE, isNatural: false };
    }
    if (f.status === 'error') {
      return { ...base, level: 'close', corrected: f.fixed ?? variant, message: f.message, isNatural: false };
    }
    if (f.status === 'unknown') {
      const list = f.words.slice(0, 3).map((w) => `«${w}»`).join(', ');
      return {
        ...base, level: 'close', corrected: variant, isNatural: false,
        message: `Глагол «съм» и порядок слов в вашей фразе в порядке, но слова ${list} приложение проверить не может, поэтому не засчитывает фразу как верную. Если вы уверены в этих словах, можно идти дальше. Образец ответа показан ниже.`,
      };
    }
  }

  const onTopic = turn.keys.some((k) => toks.some((t) => t.startsWith(normalize(k))));
  const trap = traps.some((t) => matchesTrap(norm, t));
  const badLetters = /[A-Za-zыэёЫЭЁ]/.test(input);

  if (badLetters || trap || onTopic || ratio <= 0.4) {
    return { ...base, level: 'close', corrected: variant, message: v.message ?? 'Фраза отличается от ожидаемой.', isNatural: false };
  }
  return {
    ...base,
    level: 'off',
    corrected: variant,
    message: `Эта фраза не подходит к реплике собеседника. Сейчас нужно: ${turn.task}`,
    isNatural: false,
  };
}

export const localReplyChecker: ReplyChecker = { check: checkReply };
