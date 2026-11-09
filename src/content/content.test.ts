import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, words, buildReviewExercises } from './index';
import { lessonSources } from './lessons';
import { isSameText, normalize } from '../lib/text';
import { checkBuild, checkText, matchesTrap } from '../lib/answer';
import { words as allWords } from './words';
import { stressed } from './stress';
import { readFileSync } from 'node:fs';
import type { Exercise } from '../types';

test('id слов уникальны, поля заполнены', () => {
  assert.equal(new Set(words.map((w) => w.id)).size, words.length);
  for (const w of words) assert.ok(w.bg && w.ru && w.example.bg && w.example.ru, w.id);
});

test('уроки: упражнения корректны', () => {
  assert.equal(lessons.length, lessonSources.length);
  for (const l of lessons) {
    assert.ok(l.exercises.length >= 12, `${l.id}: мало упражнений`);
    assert.equal(new Set(l.exercises.map((e) => e.id)).size, l.exercises.length, `${l.id}: дубли id`);
    for (const e of l.exercises) {
      if (e.type === 'choice') {
        assert.equal(new Set(e.options).size, e.options.length, `${e.id}: повтор вариантов`);
        assert.ok(e.options.length >= 3, e.id);
        assert.ok(e.correctIndex >= 0 && e.correctIndex < e.options.length, e.id);
      }
      if (e.type === 'build') {
        const pool = [...e.pool];
        for (const a of e.answer) {
          const i = pool.indexOf(a);
          assert.ok(i >= 0, `${e.id}: слова «${a}» нет в пуле`);
          pool.splice(i, 1);
        }
      }
      if (e.type === 'translate') assert.ok(e.accepted.length >= 1, e.id);
    }
  }
});

test('сравнение ответов игнорирует регистр, пунктуацию и ё/е', () => {
  assert.ok(isSameText('Это дорого, но сыр дешёвый.', 'это дорого но сыр дешевый'));
  assert.ok(!isSameText('Привет', 'Пока'));
});

test('повторение строит упражнения для слов словаря', () => {
  const ex = buildReviewExercises(['zdravei', 'kafe', 'bilet'], words, '2026-10-28');
  assert.equal(ex.length, 3);
});

test('новые упражнения: ввод, порядок слов, диалоги', () => {
  const kinds = { type: 0, dialogChoice: 0, dialogType: 0, buildAlt: 0 };
  for (const l of lessons) {
    for (const e of l.exercises) {
      if (e.type === 'type') {
        kinds.type++;
        for (const a of e.accepted) assert.equal(checkText(a, e.accepted, { lang: 'bg', traps: e.traps }).correct, true, `${e.id}: «${a}»`);
        for (const t of e.traps ?? []) assert.ok((t.has || t.starts) && t.say, `${e.id}: пустая ловушка`);
        if (e.hint) assert.ok(!normalize(e.hint).includes(normalize(e.accepted[0])), `${e.id}: подсказка выдаёт ответ`);
      }
      if (e.type === 'build') {
        const variants = [e.answer, ...(e.alternatives ?? [])];
        if (e.alternatives) kinds.buildAlt++;
        for (const v of variants) {
          const pool = e.pool.map((p) => p.toLowerCase());
          for (const w of v) { const i = pool.indexOf(w.toLowerCase()); assert.ok(i >= 0, `${e.id}: «${w}» нет в пуле`); pool.splice(i, 1); }
          assert.ok(e.pool.length <= e.answer.length + 3, `${e.id}: в пуле слишком много слов (дубли?)`);
          assert.equal(checkBuild(v, variants).correct, true, `${e.id}: вариант не проходит проверку`);
        }
      }
      if (e.type === 'dialog') {
        assert.ok(e.scene && e.lines.length >= 1, e.id);
        assert.ok(e.lines.some((x) => x.who === 'them'), `${e.id}: нет реплики собеседника`);
        for (const x of e.lines) assert.ok(x.bg && x.ru, e.id);
        if (e.mode === 'choice') {
          kinds.dialogChoice++;
          assert.ok(e.options.some((o) => o.ok), `${e.id}: нет верного ответа`);
          assert.ok(e.options.some((o) => !o.ok), `${e.id}: нет неверных вариантов`);
          assert.equal(new Set(e.options.map((o) => o.bg)).size, e.options.length, `${e.id}: повтор вариантов`);
          for (const o of e.options) { assert.ok(o.bg && o.ru, e.id); if (!o.ok) assert.ok(o.why, `${e.id}: нет объяснения для «${o.bg}»`); }
        } else {
          kinds.dialogType++;
          assert.ok(e.task && e.accepted.length >= 1, e.id);
          for (const a of e.accepted) assert.equal(checkText(a, e.accepted, { lang: 'bg', traps: e.traps }).correct, true, `${e.id}: «${a}»`);
          if (e.hint) assert.ok(!normalize(e.hint).includes(normalize(e.accepted[0])), `${e.id}: подсказка выдаёт ответ`);
        }
      }
    }
  }
  assert.ok(kinds.type >= 5 && kinds.dialogChoice >= 4 && kinds.dialogType >= 2 && kinds.buildAlt >= 1, JSON.stringify(kinds));
});

test('в каждом уроке есть ввод, диалог и не больше 20 упражнений', () => {
  for (const l of lessons) {
    assert.ok(l.exercises.some((e) => e.type === 'type'), `${l.id}: нет ввода`);
    assert.ok(l.exercises.some((e) => e.type === 'dialog'), `${l.id}: нет диалога`);
    assert.ok(l.exercises.length <= (['glagoli-dvizhenie', 'predlozi'].includes(l.id) ? 40 : l.id === 'glagol-sam' ? 30 : 20), `${l.id}: ${l.exercises.length}`);
  }
});

test('типичные неверные ответы НЕ принимаются', () => {
  const t = lessons.flatMap((l) => l.exercises).filter((e) => e.type === 'type');
  for (const e of t) {
    assert.equal(checkText('да', e.accepted, { lang: 'bg' }).correct, false);
    assert.equal(checkText(e.prompt, e.accepted, { lang: 'bg' }).correct, false, 'русская фраза как ответ');
  }
});

const NEW = ['semeystvo', 'chisla-i-vreme', 'magazin-i-apteka', 'pazaruvane', 'gradski-transport', 'sasedite', 'parikmaherska', 'drehi-i-obuvki', 'banka-i-smetki', 'svobodno-obshtuvane'];

test('уроки 5–14: состав и объём', () => {
  for (const id of NEW) {
    const l = lessons.find((x) => x.id === id);
    assert.ok(l, `нет урока ${id}`);
    assert.ok(l.words.length >= 8 && l.words.length <= 10, `${id}: слов ${l.words.length}`);
    assert.ok(l.intro.length >= 2 && l.intro.every((b) => b.heading && b.text.length >= 1), `${id}: мало объяснений`);
    const count = (f: (e: Exercise) => boolean) => l.exercises.filter(f).length;
    assert.ok(count((e) => e.type === 'choice') >= 8, `${id}: выбор`);
    assert.ok(count((e) => e.type === 'translate') >= 2, `${id}: перевод`);
    assert.ok(count((e) => e.type === 'build') >= 2, `${id}: сборка`);
    assert.ok(count((e) => e.type === 'type') >= 2, `${id}: ввод`);
    assert.ok(count((e) => e.type === 'dialog' && e.mode === 'choice') >= 1, `${id}: диалог-выбор`);
    assert.ok(count((e) => e.type === 'dialog' && e.mode === 'type') >= 1, `${id}: диалог-ввод`);
    assert.ok(l.exercises.length >= 17 && l.exercises.length <= 20, `${id}: ${l.exercises.length} упр.`);
    // к каждому предложению есть пояснение
    for (const s of lessonSources.find((x) => x.id === id)!.sentences) assert.ok(s.note, `${id}: нет пояснения у «${s.bg}»`);
  }
});

test('везде в упражнениях на выбор есть объяснение неверных вариантов', () => {
  for (const l of lessons) for (const e of l.exercises) {
    if (e.type !== 'choice') continue;
    assert.ok(e.why && e.why.length === e.options.length, `${e.id}: why`);
    e.options.forEach((_, i) => assert.equal(Boolean(e.why![i]), i !== e.correctIndex, `${e.id}: объяснение варианта ${i}`));
  }
});

test('болгарские тексты: без латиницы и русских «ы, э, ё»', () => {
  const bad = /[A-Za-zыэёЫЭЁ]/;
  const strings: string[] = [];
  for (const w of allWords) strings.push(w.bg, w.example.bg);
  for (const l of lessonSources) {
    for (const s of l.sentences) strings.push(s.bg, ...(s.bgAlt ?? []), ...(s.distractors ?? []));
    for (const d of l.dialogs ?? []) {
      strings.push(...d.lines.filter((x) => x.who).map((x) => x.bg));
      if (d.mode === 'choice') strings.push(...d.options.map((o) => o.bg)); else strings.push(...d.accepted);
    }
  }
  for (const t of strings) assert.ok(!bad.test(t), `подозрительные буквы: «${t}»`);
});

test('русские переводы: без латиницы, у каждого слова есть пример', () => {
  for (const w of allWords) { assert.ok(!/[A-Za-z]/.test(w.ru + w.example.ru), w.id); assert.ok(w.example.bg.length > 3, w.id); }
  for (const l of lessonSources) for (const s of l.sentences) assert.ok(!/[A-Za-z]/.test([s.ru, ...(s.ruAlt ?? [])].join(' ')), s.bg);
});

test('«ловушки»: срабатывают и не задевают верные ответы', () => {
  for (const l of lessons) for (const e of l.exercises) {
    if (!(e.type === 'type' || (e.type === 'dialog' && e.mode === 'type')) || !e.traps) continue;
    const norm = e.accepted.map(normalize);
    e.traps.forEach((t, i) => {
      for (const a of norm) assert.equal(matchesTrap(a, t), false, `${e.id}: ловушка №${i + 1} задевает верный ответ «${a}»`);
      const sample = t.has ?? `${t.starts} много`;
      const expected = e.traps!.find((x) => matchesTrap(normalize(sample), x))!.say;
      assert.equal(checkText(sample, e.accepted, { lang: 'bg', traps: e.traps }).message, expected, `${e.id}: ловушка №${i + 1} не срабатывает`);
    });
  }
});

test('слова из карточек не повторяются между уроками', () => {
  const ids = lessonSources.flatMap((l) => l.wordIds);
  assert.equal(new Set(ids).size, ids.length, 'слово входит в два урока');
  for (const id of ids) assert.ok(allWords.some((w) => w.id === id), id);
});

const L8_10 = ['pazaruvane', 'gradski-transport', 'sasedite'];
const L11_14 = ['parikmaherska', 'drehi-i-obuvki', 'banka-i-smetki', 'svobodno-obshtuvane'];

test('уроки 8–14: идут после уроков 1–7, уроки 1–7 не тронуты', () => {
  assert.deepEqual(
    lessons.map((l) => l.id),
    ['privetstviya', 'v-kafeneto', 'na-pazara', 'transport', 'semeystvo', 'chisla-i-vreme', 'magazin-i-apteka', ...L8_10, ...L11_14, 'glagol-sam', 'glagoli-dvizhenie', 'predlozi'],
  );
  assert.equal(lessons.find((l) => l.id === 'privetstviya')!.words.length, 8);
  assert.equal(allWords.filter((w) => !lessonSources.some((l) => l.wordIds.includes(w.id))).length, 0, 'есть слова вне уроков');
});

test('уроки 8–10: у каждого слова есть ударение и пример, слов не больше десяти', () => {
  for (const id of [...L8_10, ...L11_14]) {
    const src = lessonSources.find((l) => l.id === id)!;
    assert.ok(src.wordIds.length >= 8 && src.wordIds.length <= 10, id);
    for (const wid of src.wordIds) {
      const w = allWords.find((x) => x.id === wid)!;
      const vowels = [...w.bg].filter((ch) => 'аъоуеиюя'.includes(ch)).length;
      // в односложных словах ударение не отмечают, во всех остальных — обязательно
      const needs = w.bg.split(' ').some((part) => [...part].filter((ch) => 'аъоуеиюя'.includes(ch)).length > 1);
      if (needs) assert.ok(stressed(w.bg), `${id}: нет ударения у «${w.bg}»`);
    }
  }
});

test('уроки 8–10: темы раскрыты (ключевые слова на месте)', () => {
  const has = (id: string, ...bgs: string[]) => {
    const src = lessonSources.find((l) => l.id === id)!;
    const text = [...src.sentences.flatMap((s) => [s.bg, ...(s.bgAlt ?? [])]), ...allWords.filter((w) => src.wordIds.includes(w.id)).map((w) => w.bg)].join(' ').toLowerCase();
    for (const b of bgs) assert.ok(text.includes(b), `${id}: нет «${b}»`);
  };
  has('pazaruvane', 'торбичка', 'претеглете', 'пресни', 'каса', 'още', 'това е всичко');
  has('gradski-transport', 'автобус', 'трамвай', 'тролейбус', 'прекачвам', 'сляза', 'тръгва', 'центъра', 'летище');
  has('sasedite', 'заповядайте', 'с удоволствие', 'съжалявам', 'помогнете', 'поканата', 'квартал', 'става');
});

test('уроки 8–10: есть выбор, сборка, перевод, ввод, диалог из нескольких реплик и ответ вводом', () => {
  for (const id of L8_10) {
    const l = lessons.find((x) => x.id === id)!;
    const dialogs = l.exercises.filter((e): e is Extract<Exercise, { type: 'dialog' }> => e.type === 'dialog');
    assert.ok(dialogs.some((d) => d.lines.length >= 3), `${id}: нет диалога из нескольких реплик`);
    assert.ok(dialogs.some((d) => d.mode === 'type'), `${id}: нет ответа вводом`);
    assert.ok(l.intro.length >= 3, `${id}: мало объяснений`);
    // объяснение по-русски: в тексте объяснений нет латиницы
    for (const b of l.intro) assert.ok(!/[A-Za-z]/.test(b.heading + b.text.join(' ')), `${id}: латиница в объяснении`);
  }
});

test('уроки 8–10: естественные варианты принимаются, неверные и русский текст — нет', () => {
  for (const id of L8_10) {
    const l = lessons.find((x) => x.id === id)!;
    for (const e of l.exercises) {
      if (e.type !== 'type') continue;
      assert.ok(e.accepted.length >= 1);
      assert.equal(checkText(e.accepted[0].toLowerCase(), e.accepted, { lang: 'bg' }).correct, true, `${e.id}: регистр не должен делать ответ неверным`);
      assert.equal(checkText('не знам', e.accepted, { lang: 'bg' }).correct, false);
    }
  }
  const t = lessons.find((l) => l.id === 'pazaruvane')!.exercises.find((e) => e.id === 'pazaruvane-y1');
  assert.ok(t && t.type === 'type');
  for (const ok of ['Може ли торбичка, моля?', 'торбичка моля', 'Една торбичка, моля.', 'Може ли една торбичка моля']) {
    assert.equal(checkText(ok, t.accepted, { lang: 'bg', traps: t.traps }).correct, true, ok);
  }
  const bad = checkText('Може ли пакет, моля?', t.accepted, { lang: 'bg', traps: t.traps });
  assert.equal(bad.correct, false);
  assert.ok(bad.message && /торбичка/.test(bad.message));
});

test('все слова 8–10 доступны для повторения', () => {
  const ids = lessonSources.filter((l) => L8_10.includes(l.id)).flatMap((l) => l.wordIds);
  const ex = buildReviewExercises(ids, words, '2026-11-03');
  assert.equal(ex.length, ids.length);
});

test('уроки 11–14: ровно 8 новых слов, у каждого пример, ударение, пояснения по-русски', () => {
  for (const id of L11_14) {
    const src = lessonSources.find((l) => l.id === id)!;
    assert.equal(src.wordIds.length, 8, id);
    for (const wid of src.wordIds) {
      const w = allWords.find((x) => x.id === wid)!;
      assert.ok(w.example.bg && w.example.ru, wid);
      if (w.bg.split(' ').some((part) => [...part].filter((ch) => 'аъоуеиюя'.includes(ch)).length > 1)) assert.ok(stressed(w.bg), `${id}: нет ударения у «${w.bg}»`);
    }
    const l = lessons.find((x) => x.id === id)!;
    assert.ok(l.intro.length >= 3 && l.intro.every((b) => /[а-яё]/i.test(b.text.join(' '))), `${id}: объяснения`);
    const dialogs = l.exercises.filter((e) => e.type === 'dialog');
    assert.equal(dialogs.length, 2, `${id}: диалогов`);
    assert.ok(dialogs.every((d) => d.type === 'dialog' && d.lines.length >= 1) && dialogs.some((d) => d.type === 'dialog' && d.lines.length >= 3), `${id}: диалог из нескольких реплик`);
    assert.ok(l.exercises.filter((e) => e.type === 'type').length >= 3, `${id}: самостоятельные фразы`);
  }
});

test('уроки 11–14: темы раскрыты', () => {
  const text = (id: string) => {
    const src = lessonSources.find((l) => l.id === id)!;
    return [...src.sentences.flatMap((s) => [s.bg, ...(s.bgAlt ?? [])]), ...allWords.filter((w) => src.wordIds.includes(w.id)).map((w) => w.bg),
      ...(src.dialogs ?? []).flatMap((d) => d.lines.map((x) => x.bg))].join(' ').toLowerCase();
  };
  const need: Record<string, string[]> = {
    parikmaherska: ['подстригване', 'боядисване', 'прическа', 'по-късо', 'колко струва', 'колко време', 'свободен'],
    'drehi-i-obuvki': ['номер', 'пробвам', 'пробна', 'цвят', 'модел', 'върна', 'тясно', 'ако не ми станат'],
    'banka-i-smetki': ['банкомат', 'изтегля', 'превод', 'такса', 'платя', 'сметката за тока', 'сметката за водата', 'до кога'],
    'svobodno-obshtuvane': ['времето', 'планове', 'уикенд', 'обичам', 'според мен', 'съгласен', 'мисля, че', 'защото', 'а ти'],
  };
  for (const [id, list] of Object.entries(need)) for (const b of list) assert.ok(text(id).includes(b), `${id}: нет «${b}»`);
});

test('урок 14: фразы длиннее, чем в уроках 1–10', () => {
  const avg = (id: string) => {
    const src = lessonSources.find((l) => l.id === id)!;
    return src.sentences.reduce((n, s) => n + s.bg.split(/\s+/).length, 0) / src.sentences.length;
  };
  assert.ok(avg('svobodno-obshtuvane') > avg('pazaruvane'), 'фразы урока 14 должны быть длиннее');
  assert.ok(lessonSources.find((l) => l.id === 'svobodno-obshtuvane')!.sentences.some((s) => s.bg.split(/\s+/).length >= 8));
});

test('уроки 11–14: принимаются разные естественные ответы, ошибки объясняются', () => {
  const ex = (id: string) => lessons.flatMap((l) => l.exercises).find((e) => e.id === id)!;
  const t1 = ex('drehi-i-obuvki-y1');
  assert.ok(t1.type === 'type');
  for (const ok of ['Тясно ми е. Имате ли по-голям номер?', 'малко ми е тясно, имате ли по-голям размер', 'Тясно ми е, имате ли по-голям номер']) {
    assert.equal(checkText(ok, t1.accepted, { lang: 'bg', traps: t1.traps }).correct, true, ok);
  }
  const t2 = ex('svobodno-obshtuvane-y2');
  assert.ok(t2.type === 'type');
  assert.equal(checkText('Съгласна съм с теб, но имам въпрос', t2.accepted, { lang: 'bg', traps: t2.traps }).correct, true);
  assert.equal(checkText('Съгласен съм с теб но имам един въпрос', t2.accepted, { lang: 'bg', traps: t2.traps }).correct, true);
  const bad = checkText('Съгласен съм с ти, но имам един въпрос', t2.accepted, { lang: 'bg', traps: t2.traps });
  assert.equal(bad.correct, false);
  assert.match(bad.message ?? '', /С теб/);
  const t3 = ex('parikmaherska-y0');
  assert.ok(t3.type === 'type');
  assert.match(checkText('Искам стрижка', t3.accepted, { lang: 'bg', traps: t3.traps }).message ?? '', /подстригване/);
});

// ------------------------------------------------------------------ урок 15: глагол «съм»

const L15 = () => lessons.find((l) => l.id === 'glagol-sam')!;
const FORM_OF: Record<string, string> = { аз: 'съм', ти: 'си', той: 'е', тя: 'е', то: 'е', ние: 'сме', вие: 'сте', те: 'са' };
const CLITIC = ['съм', 'си', 'сме', 'сте', 'са'];

/** Все болгарские фразы урока 15, которые считаются верными */
function correctSentences15(): string[] {
  const src = lessonSources.find((l) => l.id === 'glagol-sam')!;
  const out: string[] = [];
  for (const s of src.sentences) if (s.kind === 'type' || s.kind === 'build') out.push(s.bg, ...(s.bgAlt ?? []).filter((a) => a.includes(' ')));
  for (const d of src.dialogs ?? []) {
    out.push(...d.lines.map((x) => x.bg));
    if (d.mode === 'choice') out.push(...d.options.filter((o) => o.ok).map((o) => o.bg)); else out.push(...d.accepted);
  }
  for (const f of src.formChoices ?? []) out.push(f.prompt.replace('___', f.answer));
  for (const id of src.wordIds) out.push(allWords.find((w) => w.id === id)!.example.bg);
  return out;
}

test('урок 15: идёт последним, уроки 1–14 не изменились (число упражнений и слов)', () => {
  const before: [string, number, number][] = [['privetstviya', 17, 8], ['v-kafeneto', 18, 8], ['na-pazara', 18, 8], ['transport', 18, 8], ['semeystvo', 20, 9], ['chisla-i-vreme', 20, 9], ['magazin-i-apteka', 20, 9], ['pazaruvane', 20, 8], ['gradski-transport', 20, 8], ['sasedite', 20, 8], ['parikmaherska', 20, 8], ['drehi-i-obuvki', 20, 8], ['banka-i-smetki', 20, 8], ['svobodno-obshtuvane', 20, 8]];
  assert.deepEqual(lessons.slice(0, 14).map((l) => [l.id, l.exercises.length, l.words.length]), before);
  assert.equal(lessons.length, 17);
  assert.equal(lessons[14].id, 'glagol-sam');
});

test('урок 15: таблица спряжения «съм» верна и полна', () => {
  const t = L15().intro[0].table!;
  assert.deepEqual(t.head, ['Лицо', 'Форма', 'Перевод']);
  assert.deepEqual(t.rows, [
    ['Аз', 'съм', 'я есть'], ['Ти', 'си', 'ты есть'], ['Той / Тя / То', 'е', 'он / она / оно есть'],
    ['Ние', 'сме', 'мы есть'], ['Вие', 'сте', 'вы есть'], ['Те', 'са', 'они есть'],
  ]);
});

test('урок 15: объяснения по-русски охватывают тему (использование, «не», «ли», прилагательные)', () => {
  const text = L15().intro.map((b) => b.heading + ' ' + b.text.join(' ')).join(' ');
  for (const k of ['Зачем он нужен', 'Отрицание', '«ли»', 'Прилагательные', 'не стоят в начале', 'согласуется', 'женского рода']) assert.ok(text.includes(k), `нет: ${k}`);
});

test('урок 15: все примеры из задания есть в уроке', () => {
  const all = normalize([
    ...L15().intro.flatMap((b) => b.text),
    ...L15().words.flatMap((w) => [w.bg, w.example.bg]),
    ...correctSentences15(),
  ].join(' '));
  const required = [
    'Аз съм от Русия', 'Ти си много добра', 'Той е лекар', 'Тя е уморена', 'Ние сме приятели', 'Вие сте много любезни', 'Те са в България',
    'Аз не съм уморена', 'Той не е лекар', 'Ние не сме вкъщи', 'Те не са готови',
    'Ти от България ли си', 'Той лекар ли е', 'Вие свободни ли сте', 'Те готови ли са',
    'Как си', 'Добре съм, благодаря', 'Много съм доволна', 'Днес съм свободна', 'България е много красива', 'Радвам се, че сме тук',
  ];
  for (const r of required) assert.ok(all.includes(normalize(r)), `нет примера: ${r}`);
});

test('урок 15: грамматика — форма «съм» согласуется с местоимением, «не» и «ли» на своих местах', () => {
  const sentences = correctSentences15();
  const re = /(?:^|\s)(аз|ти|той|тя|то|ние|вие|те)(?: не)? (съм|си|е|сме|сте|са)(?=\s|$)/;
  const reLi = /(?:^|\s)(аз|ти|той|тя|то|ние|вие|те)(?: \S+)? ли (съм|си|е|сме|сте|са)(?=\s|$)/;
  let checked = 0;
  for (const raw of sentences) {
    for (const part of raw.split(/[.!?]+/).map((p) => normalize(p)).filter(Boolean)) {
      const m = re.exec(part) ?? reLi.exec(part);
      if (m) { checked++; assert.equal(m[2], FORM_OF[m[1]], `«${part}»: «${m[1]}» требует «${FORM_OF[m[1]]}»`); }
      assert.ok(!/(^|\s)(съм|е|са|си|сме|сте) не(\s|$)/.test(part), `«${part}»: «не» должно стоять перед глаголом`);
    }
    // формы-клитики не начинают фразу
    for (const part of raw.split(/[.!?]+/).map((p) => normalize(p)).filter(Boolean)) {
      assert.ok(!CLITIC.includes(part.split(' ')[0]) || part.split(' ').length === 1, `«${part}»: фраза начинается с краткой формы «съм»`);
    }
  }
  assert.ok(checked >= 25, `проверено фраз: ${checked}`);
});

test('урок 15: согласование прилагательных (род и число)', () => {
  const ok = [
    ['тя е уморена', 'ж'], ['ти си много добра', 'ж'], ['те са готови', 'мн'], ['вие сте много любезни', 'мн'],
    ['българия е много красива', 'ж'], ['аз съм много доволна', 'ж'], ['аз не съм уморена', 'ж'],
  ] as const;
  const all = normalize(correctSentences15().join(' ') + ' ' + L15().intro.flatMap((b) => b.text).join(' '));
  for (const [p] of ok) assert.ok(all.includes(p), p);
  // «България» женского рода: нет «красив е»/«красиво»
  assert.ok(!/българия (е|са) (много )?(красив|красиво|красиви)(\s|$)/.test(all));
});

test('урок 15: выбор формы — все шесть лиц, верный ответ среди вариантов, у неверных есть объяснение', () => {
  const choices = L15().exercises.filter((e) => e.type === 'choice' && /___/.test(e.prompt));
  assert.equal(choices.length, 4);
  for (const e of choices) {
    assert.ok(e.type === 'choice');
    assert.equal(e.options.length, 3);
    const right = e.options[e.correctIndex];
    assert.equal(right, FORM_OF[normalize(e.prompt).split(' ')[0]], e.prompt);
    e.options.forEach((o, i) => assert.equal(Boolean(e.why?.[i]), i !== e.correctIndex, `${e.id}: объяснение для «${o}»`));
    assert.ok(!/[A-Za-z]/.test(e.prompt + e.options.join('')));
  }
});

test('урок 15: пропуски покрывают все шесть лиц и принимают форму или всю фразу', () => {
  const gaps = L15().exercises.filter((e) => e.type === 'type' && e.prompt.startsWith('Вставьте'));
  assert.equal(gaps.length, 6);
  const persons = gaps.map((e) => normalize(e.type === 'type' ? e.accepted[0] : '').split(' ')[0]);
  assert.deepEqual(persons.sort(), ['аз', 'вие', 'ние', 'те', 'ти', 'той']);
  for (const e of gaps) {
    assert.ok(e.type === 'type');
    const form = FORM_OF[normalize(e.accepted[0]).split(' ')[0]];
    assert.equal(checkText(form, e.accepted, { lang: 'bg', traps: e.traps }).correct, true, e.id);
    assert.equal(checkText(e.accepted[0], e.accepted, { lang: 'bg', traps: e.traps }).correct, true, e.id);
    // любая другая форма получает объяснение
    for (const other of CLITIC.concat('е').filter((f) => f !== form)) {
      const v = checkText(other, e.accepted, { lang: 'bg', traps: e.traps });
      assert.equal(v.correct, false, `${e.id}: «${other}»`);
      assert.ok(v.message && v.message.includes(`«${other}»`), `${e.id}: объяснение для «${other}»`);
    }
  }
});

test('урок 15: отрицание и вопросы принимают разные верные варианты и объясняют ошибки', () => {
  const ex = (id: string) => L15().exercises.find((e) => e.id === id)!;
  const neg = lessons.find((l) => l.id === 'glagol-sam')!.exercises.filter((e) => e.type === 'type' && e.prompt.startsWith('Сделайте отрицание'));
  const qs = lessons.find((l) => l.id === 'glagol-sam')!.exercises.filter((e) => e.type === 'type' && e.prompt.startsWith('Постройте вопрос'));
  assert.equal(neg.length, 3);
  assert.equal(qs.length, 3);
  for (const e of neg) { assert.ok(e.type === 'type'); assert.ok(e.accepted.every((a) => /(^|\s)не (съм|е|са)(\s|$)/.test(normalize(a))), e.id); }
  for (const e of qs) { assert.ok(e.type === 'type'); assert.ok(e.accepted.every((a) => /(^|\s)ли (си|е|са)(\s|$)/.test(normalize(a))), e.id); }
  const n1 = neg[0]; const q1 = qs[0];
  assert.ok(n1.type === 'type' && q1.type === 'type');
  for (const ok of ['Аз не съм уморена.', 'не съм уморена', 'Аз не съм уморена']) assert.equal(checkText(ok, n1.accepted, { lang: 'bg', traps: n1.traps }).correct, true, ok);
  assert.match(checkText('Аз съм не уморена', n1.accepted, { lang: 'bg', traps: n1.traps }).message ?? '', /ПЕРЕД/);
  for (const ok of ['Ти свободна ли си?', 'свободна ли си', 'Свободна ли си?']) assert.equal(checkText(ok, q1.accepted, { lang: 'bg', traps: q1.traps }).correct, true, ok);
  assert.match(checkText('Ти си ли свободна?', q1.accepted, { lang: 'bg', traps: q1.traps }).message ?? '', /ПОСЛЕ/);
  assert.ok(ex('glagol-sam-f0'));
});

test('урок 15: пять диалогов — знакомство, самочувствие, работа, семья, жизнь в Болгарии', () => {
  const d = L15().exercises.filter((e) => e.type === 'dialog');
  assert.equal(d.length, 5);
  assert.deepEqual(d.map((x) => x.type === 'dialog' && x.scene.split('.')[0]), ['Знакомство', 'Самочувствие', 'Работа', 'Семья', 'Жизнь в Болгарии']);
  assert.ok(d.filter((x) => x.type === 'dialog' && x.lines.length >= 3).length >= 4);
  assert.ok(d.some((x) => x.type === 'dialog' && x.mode === 'type') && d.some((x) => x.type === 'dialog' && x.mode === 'choice'));
});

test('урок 15: в болгарских текстах нет латиницы и «ы, э, ё»; в русских объяснениях нет латиницы', () => {
  const bad = /[A-Za-zыэёЫЭЁ]/;
  for (const s of correctSentences15()) assert.ok(!bad.test(s), s);
  const ru = [...L15().intro.flatMap((b) => [b.heading, ...b.text.filter((t) => !/[а-я]/.test(t) || true).map((t) => t.replace(/[А-Яа-яЁёѝ«».,:;!?\-–—()\s/…0-9]/g, ''))])].join('');
  assert.ok(!/[A-Za-z]/.test(ru), 'латиница в объяснении');
});

test('урок 15: таблица показывается в интерфейсе урока, а озвучивание слов и фраз подключено', () => {
  const flow = readFileSync('src/components/LessonFlow.tsx', 'utf-8');
  assert.ok(flow.includes('b.table') && flow.includes('gtable'));
  assert.ok(flow.includes('<SpeakerButton text={w.bg}'));
});
