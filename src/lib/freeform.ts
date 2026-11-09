// Свободная проверка ответов с глаголом «съм».
// Ответ не сравнивается с образцом дословно: проверяется грамматика рамки
// (одна нужная форма «съм», место «не», «ли», согласование сказуемого, «съм» не в начале фразы),
// а допустимые слова берутся из рамки хода (FreeSpec). Что проверить нельзя — не засчитывается «на глаз».
import type { FreeSpec } from '../types';
import { tokens } from './answer';

export const SAM_FORMS = ['съм', 'си', 'е', 'сме', 'сте', 'са'];
const SUBJECT: Record<string, string> = { съм: 'аз', сме: 'ние', сте: 'вие', са: 'те' };
const WHO: Record<string, string> = { съм: 'аз', си: 'ти', е: 'он / она / оно', сме: 'ние', сте: 'вие', са: 'они' };
/** Наречия, которые могут стоять между «не» и глаголом: «не много съм доволна» */
const NEG_ADV = ['много', 'особено', 'напълно', 'съвсем', 'толкова'];
/** Начало ответа, не влияющее на грамматику рамки */
const LEAD: string[][] = [
  ['здравей'], ['здравейте'], ['привет'], ['добър', 'ден'], ['добър', 'вечер'],
  ['приятно', 'ми', 'е'], ['разбира', 'се'], ['наистина'], ['всъщност'], ['ами'], ['благодаря'],
];
const GLOBAL_WORDS = ['аз', 'не', 'благодаря'];

export type FreeResult =
  | { status: 'ok' }
  | { status: 'error'; message: string; fixed?: string }
  | { status: 'unknown'; words: string[] }
  | { status: 'skip' };

const q = (w: string) => `«${w}»`;
/** Заглавная буква и точка в конце */
const tidy = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) + '.' : t;
};

function startsWith(t: string[], p: string[]): boolean {
  return p.length > 0 && t.length >= p.length && p.every((w, i) => t[i] === w);
}
function endsWith(t: string[], p: string[]): boolean {
  return p.length > 0 && t.length >= p.length && p.every((w, i) => t[t.length - p.length + i] === w);
}

export function checkFree(spec: FreeSpec, input: string): FreeResult {
  const FORMS = spec.formSet ?? SAM_FORMS;
  let t = tokens(input);
  if (t.length === 0) return { status: 'skip' };

  // 1) начало: приветствие, «да», «не» как ответ
  let yes = false;
  let no = false;
  for (let guard = 0; guard < 8; guard++) {
    const lead = LEAD.find((l) => startsWith(t, l));
    if (lead) { t = t.slice(lead.length); continue; }
    if (t[0] === 'да') { yes = true; t = t.slice(1); continue; }
    if (t[0] === 'не') {
      const direct = FORMS.includes(t[1] ?? '') || (NEG_ADV.includes(t[1] ?? '') && FORMS.includes(t[2] ?? ''));
      if (!direct) { no = true; t = t.slice(1); continue; }
    }
    break;
  }
  // 2) конец: «хвосты» («а ти?», «работя в офис», «нали») и «благодаря»
  const tails = [...(spec.tails ?? []).map((x) => x.split(' ')), ['благодаря']];
  if (spec.question) tails.push(['нали']);
  for (let guard = 0; guard < 4; guard++) {
    const tail = tails.filter((x) => endsWith(t, x)).sort((a, b) => b.length - a.length)[0];
    if (!tail) break;
    t = t.slice(0, t.length - tail.length);
  }
  t = t.filter((w) => w !== 'благодаря');
  if (t.length === 0) return { status: 'skip' };

  const vocab = new Set([...spec.forms, ...spec.predicates, ...(spec.extras ?? []), ...GLOBAL_WORDS, ...(spec.question ? ['ли'] : [])]);
  const formIdx = t.map((w, i) => (FORMS.includes(w) ? i : -1)).filter((i) => i >= 0);
  const formsUsed = formIdx.map((i) => t[i]);

  // 3) неверная форма «съм» (в том числе лишняя)
  const wrong = formsUsed.find((f) => !spec.forms.includes(f));
  if (wrong) {
    const need = spec.forms[0];
    const hint = wrong === 'си' && need === 'съм' ? ' «Си» — это «ты», а про себя говорят «съм».' : '';
    return {
      status: 'error',
      message: `Здесь нужна форма ${q(need)}${WHO[need] ? ` (${WHO[need]})` : ''}, а вы сказали ${q(wrong)}${WHO[wrong] ? ` (${WHO[wrong]})` : ''}.${hint}`,
      fixed: spec.forms.length === 1 && !formsUsed.includes(need) ? tidy(t.map((w) => (w === wrong ? need : w)).join(' ')) : undefined,
    };
  }

  // 4) повтор той же формы: «съм свободна съм»
  if (formsUsed.length > 1 && new Set(formsUsed).size > 1) return { status: 'skip' };
  if (formsUsed.length > 1) {
    const f = formsUsed[0];
    const fixed = t.filter((w, i) => !(w === f && formIdx.indexOf(i) > 0));
    return {
      status: 'error',
      message: `Глагол ${q(f)} в одной фразе нужен один раз, а вы сказали его дважды. Второе ${q(f)} лишнее: «${tidy(fixed.join(' ')).replace(/\.$/, '')}».`,
      fixed: tidy(fixed.join(' ')),
    };
  }

  const idx = formIdx[0];
  const form = idx === undefined ? undefined : t[idx];

  if (form === undefined) {
    if (!spec.verbOptional) {
      return { status: 'error', message: `В этой фразе нужен глагол ${q(spec.forms[0])}: по-болгарски здесь говорят полным предложением.` };
    }
  } else {
    // 5) «съм» не стоит в начале фразы
    if (idx === 0 && !spec.verbFirstOk) {
      const subj = SUBJECT[form];
      return {
        status: 'error',
        message: `${q(form)} не может стоять в начале фразы.${subj ? ` Скажите «${subj} ${form} …» или поставьте перед ним другое слово.` : ' Поставьте перед ним другое слово.'}`,
        fixed: subj ? tidy([subj, ...t].join(' ')) : undefined,
      };
    }
    // 6) «не» — прямо перед глаголом
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== 'не') continue;
      const ok = t[i + 1] === form || (NEG_ADV.includes(t[i + 1] ?? '') && t[i + 2] === form);
      if (!ok) {
        return { status: 'error', message: `Отрицание «не» ставится прямо перед глаголом: «не ${form} …».` };
      }
    }
    // 7) «ли» — прямо перед глаголом
    const li = t.indexOf('ли');
    if (spec.liAfter) {
      if (li >= 0 && li !== idx + 1) return { status: 'error', message: `В вопросе «ли» стоит сразу после глагола: «${form} ли …?».` };
    } else if (li >= 0 && (li !== idx - 1 || li === 0)) {
      return { status: 'error', message: `В вопросе «ли» стоит прямо перед глаголом: «… ли ${form}?».` };
    }
  }

  // 8) «да»/«нет» не противоречат отрицанию
  const negated = t.includes('не');
  if (spec.yesNo) {
    if (yes && negated) {
      return { status: 'error', message: '«Да» и отрицание «не съм» противоречат друг другу: скажите либо «Да, …», либо «Не, не съм …».' };
    }
    if (no && !negated) {
      return { status: 'error', message: 'Вы начали с «не», но дальше фраза утвердительная. Для отказа нужно «Не, не съм …».' };
    }
  }

  // 9) сказуемое: нужное слово и согласование
  const hasPredicate = t.some((w) => spec.predicates.includes(w));
  const placeIdx = spec.openPlace ? t.indexOf('от') : -1;
  const hasPlace = placeIdx >= 0 && placeIdx + 1 < t.length && !FORMS.includes(t[placeIdx + 1]) && t[placeIdx + 1] !== 'не';
  for (const w of t) {
    if (vocab.has(w) || !spec.stems?.some((s) => w.startsWith(s))) continue;
    return {
      status: 'error',
      message: `Слово ${q(w)} не согласуется. ${spec.agreeHint ?? `Нужно: ${spec.predicates.slice(0, 3).map(q).join(', ')}.`}`,
    };
  }
  if (!hasPredicate && !hasPlace) return { status: 'skip' };

  for (const need of spec.required ?? []) {
    if (!t.includes(need)) return { status: 'error', message: `Здесь нужна частица ${q(need)}: с этим глаголом она обязательна (например, «връщам се»).` };
  }
  // 9б) предлог при слове: «на работа», а не «в работа»
  for (const [word, preps] of Object.entries(spec.pairs ?? {})) {
    const i = t.indexOf(word);
    if (i < 0) continue;
    if (!preps.includes(t[i - 1] ?? '')) {
      const need = preps[0];
      return { status: 'error', message: `Со словом ${q(word)} употребляют предлог ${preps.map(q).join(' или ')}: «${need} ${word}».` };
    }
  }

  // 10) прочие слова должны быть известны: иначе ответ не засчитывается «на глаз»
  const unknown: string[] = [];
  t.forEach((w, i) => {
    if (vocab.has(w)) return;
    if (hasPlace && (i === placeIdx + 1 || (i === placeIdx + 2 && !FORMS.includes(w) && w !== 'не'))) return;
    unknown.push(w);
  });
  if (unknown.length) return { status: 'unknown', words: unknown };
  return { status: 'ok' };
}
