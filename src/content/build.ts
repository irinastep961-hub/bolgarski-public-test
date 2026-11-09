// Превращает «авторское» описание урока в готовые упражнения.
// Не зависит от React — можно запускать на сервере, в тестах и в скриптах.
import type {
  BuildExercise, ChoiceExercise, DialogExercise, DialogSource, FormChoiceSource, Exercise, Lesson, LessonSource, SentenceSource,
  TranslateExercise, TypeExercise, Word,
} from '../types';
import { seededShuffle } from '../lib/text';
import { words as wordsOf } from '../lib/answer';

type Dir = 'bg-ru' | 'ru-bg' | 'listen';

function choiceFor(word: Word, dir: Dir, near: Word[], far: Word[], id: string): ChoiceExercise {
  const key = (x: Word) => (dir === 'ru-bg' ? x.bg : x.ru);
  const correct = key(word);
  const seen = new Set<string>([correct]);
  const distractors: Word[] = [];
  for (const cand of [...seededShuffle(near, id), ...seededShuffle(far, id + 'f')]) {
    const k = key(cand);
    if (seen.has(k)) continue;
    seen.add(k);
    distractors.push(cand);
    if (distractors.length === 3) break;
  }
  // Порядок вариантов определяется только seed и числом вариантов
  const entries = seededShuffle([word, ...distractors], id + 'o');
  const options = entries.map(key);
  const why = entries.map((y) => {
    if (y.id === word.id) return '';
    // одинаково звучащие слова («сестра» — «сестра»): не пишем «по-болгарски — то же самое»
    if (y.bg === y.ru) return `Вы выбрали другое слово — «${y.bg}». А «${word.bg}» значит «${word.ru}».`;
    if (dir === 'ru-bg') return `«${y.bg}» значит «${y.ru}». Нужное слово — «${word.bg}» («${word.ru}»).`;
    if (dir === 'listen') return `Звучало «${word.bg}» — «${word.ru}». А «${y.ru}» по-болгарски — «${y.bg}».`;
    return `«${y.ru}» по-болгарски — «${y.bg}». А «${word.bg}» значит «${word.ru}».`;
  });
  const base = {
    id, type: 'choice' as const, options, correctIndex: entries.findIndex((y) => y.id === word.id), wordId: word.id, why,
    ...(word.note ? { note: word.note } : {}),
  };
  if (dir === 'bg-ru') return { ...base, prompt: `Что значит «${word.bg}»?` };
  if (dir === 'ru-bg') return { ...base, prompt: `Как по-болгарски: «${word.ru}»?` };
  return { ...base, prompt: 'Что вы услышали?', audio: word.bg };
}

function toTranslate(s: SentenceSource, id: string): TranslateExercise {
  return { id, type: 'translate', prompt: s.bg, accepted: [s.ru, ...(s.ruAlt ?? [])], ...(s.traps ? { traps: s.traps } : {}), ...(s.note ? { note: s.note } : {}) };
}

function toType(s: SentenceSource, id: string): TypeExercise {
  return {
    id, type: 'type', prompt: s.ru, accepted: [s.bg, ...(s.bgAlt ?? [])],
    ...(s.traps ? { traps: s.traps } : {}), ...(s.hint ? { hint: s.hint } : {}), ...(s.note ? { note: s.note } : {}),
  };
}

/** Набор слов для сборки: основной ответ + слова других вариантов + лишние слова */
function toBuild(s: SentenceSource, id: string): BuildExercise {
  const answer = wordsOf(s.bg);
  const alternatives = (s.bgAlt ?? []).map(wordsOf);
  const pool = [...answer];
  for (const alt of alternatives) {
    const rest = pool.map((p) => p.toLowerCase());
    for (const w of alt) {
      const i = rest.indexOf(w.toLowerCase());
      if (i >= 0) rest.splice(i, 1);
      else pool.push(w);
    }
  }
  pool.push(...(s.distractors ?? []));
  return {
    id, type: 'build', prompt: s.ru, answer, pool: seededShuffle(pool, id),
    ...(alternatives.length ? { alternatives } : {}), ...(s.note ? { note: s.note } : {}),
  };
}

function toFormChoice(f: FormChoiceSource, id: string): ChoiceExercise {
  const entries = seededShuffle([{ form: f.answer, why: '' }, ...f.wrong], id);
  return {
    id, type: 'choice', prompt: f.prompt, options: entries.map((e) => e.form),
    correctIndex: entries.findIndex((e) => e.form === f.answer), why: entries.map((e) => e.why),
    ...(f.note ? { note: f.note } : {}),
  };
}

function toDialog(d: DialogSource, id: string): DialogExercise {
  if (d.mode === 'choice') {
    return { ...d, id, type: 'dialog', options: seededShuffle(d.options, id) };
  }
  return { ...d, id, type: 'dialog' };
}

function interleave<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) for (const g of groups) if (i < g.length) out.push(g[i]);
  return out;
}

export function buildLesson(src: LessonSource, all: Word[]): Lesson {
  const words = src.wordIds.map((id) => {
    const found = all.find((x) => x.id === id);
    if (!found) throw new Error(`Урок «${src.id}»: нет слова «${id}»`);
    return found;
  });
  const far = all.filter((x) => !src.wordIds.includes(x.id));

  const choices = words.map((x, i) => choiceFor(x, i % 2 === 0 ? 'bg-ru' : 'ru-bg', words, far, `${src.id}-c${i}`));
  const listens = words
    .map((x, i) => ({ x, i }))
    .filter(({ i }) => i % 3 === 1)
    .map(({ x, i }) => choiceFor(x, 'listen', words, far, `${src.id}-l${i}`));
  const translates = src.sentences.filter((s) => s.kind === 'translate').map((s, i) => toTranslate(s, `${src.id}-t${i}`));
  const builds = src.sentences.filter((s) => s.kind === 'build').map((s, i) => toBuild(s, `${src.id}-b${i}`));
  const types = src.sentences.filter((s) => s.kind === 'type').map((s, i) => toType(s, `${src.id}-y${i}`));
  const dialogs = (src.dialogs ?? []).map((d, i) => toDialog(d, `${src.id}-d${i}`));
  const forms = (src.formChoices ?? []).map((f, i) => toFormChoice(f, `${src.id}-f${i}`));

  // Сначала слова, потом фразы, в конце — диалоги
  const exercises: Exercise[] = [
    ...interleave<Exercise>([choices, listens]),
    ...forms,
    ...interleave<Exercise>([builds, translates, types]),
    ...dialogs,
  ];
  return { id: src.id, title: src.title, subtitle: src.subtitle, emoji: src.emoji, intro: src.intro, words, exercises, ...(src.speakingId ? { speakingId: src.speakingId } : {}) };
}

/** Упражнения для повторения личного словаря */
export function buildReviewExercises(wordIds: string[], all: Word[], seedKey: string): Exercise[] {
  const out: Exercise[] = [];
  wordIds.forEach((id, i) => {
    const word = all.find((x) => x.id === id);
    if (!word) return;
    const dir: Dir = (['bg-ru', 'ru-bg', 'listen'] as const)[i % 3];
    out.push(choiceFor(word, dir, [], all, `rv-${seedKey}-${id}`));
  });
  return out;
}
