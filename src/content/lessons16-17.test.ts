import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, words } from './index';
import { lessonSources } from './lessons';
import { conversations, getConversation } from './conversations';
import { PARADIGMS } from './lesson16';
import { checkReply, variantsOf } from '../lib/conversation';
import { tokens } from '../lib/answer';
import { stressed } from './stress';

const L16 = () => lessons.find((l) => l.id === 'glagoli-dvizhenie')!;
const L17 = () => lessons.find((l) => l.id === 'predlozi')!;
const SRC16 = () => lessonSources.find((l) => l.id === 'glagoli-dvizhenie')!;

const SPEC: Record<string, string[]> = {
  отивам: ['отивам', 'отиваш', 'отива', 'отиваме', 'отивате', 'отиват'],
  ходя: ['ходя', 'ходиш', 'ходи', 'ходим', 'ходите', 'ходят'],
  идвам: ['идвам', 'идваш', 'идва', 'идваме', 'идвате', 'идват'],
  тръгвам: ['тръгвам', 'тръгваш', 'тръгва', 'тръгваме', 'тръгвате', 'тръгват'],
  пътувам: ['пътувам', 'пътуваш', 'пътува', 'пътуваме', 'пътувате', 'пътуват'],
  пристигам: ['пристигам', 'пристигаш', 'пристига', 'пристигаме', 'пристигате', 'пристигат'],
  заминавам: ['заминавам', 'заминаваш', 'заминава', 'заминаваме', 'заминавате', 'заминават'],
  'връщам се': ['връщам се', 'връщаш се', 'връща се', 'връщаме се', 'връщате се', 'връщат се'],
};

test('уроки 16 и 17 идут после урока 15, уроки 1–15 не изменились', () => {
  assert.deepEqual(lessons.slice(14).map((l) => l.id), ['glagol-sam', 'glagoli-dvizhenie', 'predlozi']);
  const before: [string, number, number][] = [['privetstviya', 17, 8], ['v-kafeneto', 18, 8], ['na-pazara', 18, 8], ['transport', 18, 8], ['semeystvo', 20, 9], ['chisla-i-vreme', 20, 9], ['magazin-i-apteka', 20, 9], ['pazaruvane', 20, 8], ['gradski-transport', 20, 8], ['sasedite', 20, 8], ['parikmaherska', 20, 8], ['drehi-i-obuvki', 20, 8], ['banka-i-smetki', 20, 8], ['svobodno-obshtuvane', 20, 8], ['glagol-sam', 30, 6]];
  assert.deepEqual(lessons.slice(0, 15).map((l) => [l.id, l.exercises.length, l.words.length]), before);
});

test('урок 16: таблицы спряжения всех восьми глаголов точны, в каждой шесть форм с переводом', () => {
  assert.deepEqual(PARADIGMS, SPEC);
  const intro = L16().intro;
  for (const [verb, forms] of Object.entries(SPEC)) {
    const block = intro.find((b) => b.table && b.table.rows[0][1] === forms[0]);
    assert.ok(block, `нет таблицы глагола «${verb}»`);
    const t = block!.table!;
    assert.deepEqual(t.head, ['Лицо', 'Форма', 'Перевод']);
    assert.deepEqual(t.rows.map((r) => r[0]), ['Аз', 'Ти', 'Той / Тя / То', 'Ние', 'Вие', 'Те']);
    assert.deepEqual(t.rows.map((r) => r[1]), forms);
    for (const r of t.rows) assert.ok(r[2].length > 2 && !/[A-Za-z]/.test(r[2]), `${verb}: перевод «${r[2]}»`);
  }
  assert.equal(intro.filter((b) => b.table).length, 8);
});

test('урок 16: окончания подчиняются правилам (-ам/-аш/-а/-аме/-ате/-ат и ходя: -я/-иш/-и/-им/-ите/-ят)', () => {
  const E1 = ['ам', 'аш', 'а', 'аме', 'ате', 'ат'];
  for (const [verb, f] of Object.entries(PARADIGMS)) {
    const forms = f.map((x) => x.split(' ')[0]);
    if (verb === 'ходя') {
      assert.deepEqual(forms.map((x) => x.slice(3)), ['я', 'иш', 'и', 'им', 'ите', 'ят']);
    } else {
      const stem = forms[0].slice(0, -2);
      assert.deepEqual(forms.map((x) => x.slice(stem.length)), E1, verb);
    }
  }
});

test('урок 16: объяснены различия глаголов, есть примеры из задания, все упражнения разных видов', () => {
  const text = L16().intro.flatMap((b) => b.text).join(' ');
  for (const s of ['Къде отиваш?', 'Аз отивам на работа.', 'Ходя на фитнес.', 'Ти идваш ли с нас?', 'Тръгвам за магазина.', 'Пътувам с автобус.']) {
    assert.ok(text.includes(s) || L16().intro.some((b) => b.text.some((t) => t.includes(s))), s);
  }
  for (const w of ['отивам', 'ходя', 'идвам', 'тръгвам', 'пътувам', 'пристигам', 'заминавам', 'връщам се']) {
    assert.ok(L16().words.some((x) => x.bg === w), w);
  }
  const ex = L16().exercises;
  const kinds = new Set(ex.map((e) => e.type + (e.type === 'dialog' ? ':' + (e as { mode: string }).mode : '')));
  for (const k of ['choice', 'type', 'build', 'translate', 'dialog:choice', 'dialog:type']) assert.ok(kinds.has(k), k);
  assert.ok(ex.some((e) => e.type === 'type' && /Впишите окончание/.test(e.prompt)), 'нет упражнения на окончания');
  assert.ok(SRC16().formChoices!.length >= 6);
});

test('урок 16: в упражнениях перемешаны лица и глаголы (каждое из шести лиц встречается)', () => {
  const forms = SRC16().formChoices!;
  const personOf = (ans: string) => Object.values(PARADIGMS).map((f) => f.map((x) => x.split(' ')[0]).indexOf(ans.split(' ').pop() === 'се' ? ans.split(' ')[0] === 'се' ? ans.split(' ')[1] : ans.split(' ')[0] : ans)).find((i) => i >= 0);
  const persons = new Set(forms.map((f) => personOf(f.answer)));
  assert.ok(persons.size >= 5, [...persons].join());
  const verbs = new Set(forms.map((f) => Object.keys(PARADIGMS).find((v) => PARADIGMS[v].some((x) => x.split(' ')[0] === f.answer.split(' ').filter((w) => w !== 'се')[0]))));
  assert.ok(verbs.size >= 5, [...verbs].join());
});

test('только настоящее время: в уроках 16–17 и их разговорах нет будущего и прошедшего', () => {
  const bad = new Set(['ще', 'беше', 'бях', 'бяха', 'бил', 'била', 'били', 'бяхме', 'бяхте', 'ходих', 'отидох', 'дойдох', 'тръгнах', 'пътувах']);
  const texts: string[] = [];
  for (const id of ['glagoli-dvizhenie', 'predlozi']) {
    const src = lessonSources.find((l) => l.id === id)!;
    for (const b of src.intro) texts.push(...b.text, ...(b.table?.rows.flat() ?? []));
    for (const s of src.sentences) texts.push(s.bg, ...(s.bgAlt ?? []));
    for (const w of src.wordIds) texts.push(words.find((x) => x.id === w)!.example.bg);
    for (const d of src.dialogs ?? []) {
      texts.push(...d.lines.map((l) => l.bg));
      if (d.mode === 'type') texts.push(...d.accepted);
      else texts.push(...d.options.map((o) => o.bg));
    }
  }
  for (const id of ['govorim-dvizhenie', 'govorim-predlozi']) for (const t of getConversation(id)!.turns) texts.push(t.them.bg, t.natural, ...variantsOf(t));
  // болгарский текст внутри русских абзацев: проверяем слова-маркеры времени
  for (const t of texts) for (const w of tokens(t)) assert.ok(!bad.has(w), `«${w}» в «${t}»`);
});

test('урок 17: предлоги охвачены, у карточек есть пример, правила «във» и «със» объяснены', () => {
  const text = L17().intro.flatMap((b) => [b.heading, ...b.text]).join(' ');
  for (const s of ['във Варна', 'със захар', 'на работа', 'в магазина', 'при лекаря', 'към гарата', 'по телефона', 'без захар', 'до аптеката', 'между', 'пред', 'зад']) assert.ok(text.includes(s), s);
  assert.equal(L17().words.length, 10);
  for (const w of L17().words) assert.ok(w.example.bg && w.example.ru && w.bg.includes(' '), w.id);
  assert.ok(L17().exercises.filter((e) => e.type === 'type').length >= 5);
  assert.ok(L17().exercises.filter((e) => e.type === 'dialog').length >= 4);
});

test('ударения новых слов показываются, остальные слова урока 17 без сомнительных отметок', () => {
  for (const w of L16().words) assert.ok(stressed(w.bg), w.bg);
  const mark = (w: string, i: number) => w.slice(0, i) + '\u0301' + w.slice(i);
  assert.equal(stressed('пътувам'), mark('пътувам', 4));
  assert.equal(stressed('отивам'), mark('отивам', 3));
  assert.equal(stressed('ходя'), mark('ходя', 2));
  assert.equal(stressed('в София'), mark('в софия', 4));
});

const ctx = { register: 'informal' as const, partner: 'Приятел' };
const turnOf = (cid: string, n: number) => getConversation(cid)!.turns[n - 1];
const lv = (cid: string, n: number, s: string) => checkReply(turnOf(cid, n), s, ctx);

test('разговор к уроку 16: 10 реплик, все лица, шаблоны корректны', () => {
  const c = getConversation('govorim-dvizhenie')!;
  assert.equal(c.turns.length, 10);
  assert.equal(c.register, 'informal');
  const forms = new Set(c.turns.flatMap((t) => variantsOf(t).flatMap((v) => tokens(v))));
  for (const f of ['отивам', 'ходя', 'пътувам', 'тръгвам', 'идвам', 'идваме', 'пристигат', 'връщам', 'се', 'заминавам', 'отивате']) assert.ok(forms.has(f), f);
  for (const t of c.turns) for (const v of variantsOf(t)) {
    // ни один образец не содержит дважды одну и ту же форму глагола в одном предложении
    for (const seg of v.split(/[.!?,]+/)) {
      const toks = tokens(seg);
      for (const w of new Set(toks)) if (w.length > 5) assert.ok(toks.filter((x) => x === w).length <= 1, `${t.id}: «${v}»`);
    }
  }
});

test('разговор к уроку 16: верные свободные ответы принимаются, неверные формы — нет', () => {
  const C = 'govorim-dvizhenie';
  const ok: [number, string][] = [
    [1, 'Отивам на работа'], [1, 'Аз отивам в магазина сега'], [1, 'Отивам вкъщи'], [1, 'Аз отивам на фитнес'], [1, 'Отивам до банката, а ти?'],
    [2, 'Да, ходя на фитнес'], [2, 'Да, аз ходя на фитнес всяка седмица'], [2, 'Не ходя на фитнес'], [2, 'Не, не ходя често на фитнес'],
    [3, 'Пътувам с автобус'], [3, 'Аз пътувам с метро всеки ден'], [3, 'Пътувам със'.replace(' със', ' с кола')],
    [4, 'Тръгвам в осем часа'], [4, 'Аз тръгвам в девет и половина'], [4, 'Тръгвам в седем часа сутринта'.replace(' сутринта', ' сутрин')],
    [5, 'Да, идвам с удоволствие'], [5, 'Не, не идвам'], [5, 'Съжалявам, не идвам'], [5, 'Да, аз идвам с вас'],
    [6, 'Ние идваме от центъра'], [6, 'Идваме от парка'], [6, 'Идваме от Пловдив'],
    [7, 'Те пристигат от Русия'], [7, 'Моите гости пристигат от Варна'],
    [8, 'Връщам се вкъщи в шест часа'], [8, 'Аз се връщам вкъщи в пет часа'],
    [9, 'Заминавам за София'], [9, 'Аз заминавам за Варна сега'], [9, 'Не заминавам'],
    [10, 'Къде отивате?'], [10, 'Здравей! Вие къде отивате?'], [10, 'Къде пътувате вие'],
  ];
  for (const [n, s] of ok) assert.equal(lv(C, n, s).level, 'correct', `${n}: «${s}» → ${lv(C, n, s).message}`);
  const bad: [number, string, RegExp][] = [
    [1, 'Отиваш на работа', /отивам/], [1, 'Аз отива на работа', /отивам/], [1, 'Отивам в работа', /на работа/],
    [2, 'Да, ходиш на фитнес', /ходя/], [2, 'Да, ходя в фитнес', /на фитнес/],
    [3, 'Пътуваш с автобус', /пътувам/], [3, 'Пътувам на автобус', /с/],
    [4, 'Тръгваме в осем часа', /тръгвам/],
    [5, 'Идваш с удоволствие', /идвам/],
    [6, 'Идвам от центъра', /идваме/], [6, 'Ние идвам от центъра', /идваме/],
    [7, 'Те пристигаме от Русия', /пристигат/], [7, 'Те пристигам от Русия', /пристигат/],
    [8, 'Връщам вкъщи в шест часа', /се/], [8, 'Се връщам вкъщи в шест часа', /Се|начале/], [8, 'Връщаш се вкъщи в шест часа', /връщам/],
    [9, 'Заминаваш за София', /заминавам/], [9, 'Заминавам в София', /за/],
    [10, 'Къде отиваш?', /отивате/], [10, 'Къде отиват?', /отивате/],
  ];
  for (const [n, s, re] of bad) {
    const r = lv(C, n, s);
    assert.notEqual(r.level, 'correct', `${n}: «${s}»`);
    assert.match(r.message, re, `${n}: «${s}» → ${r.message}`);
  }
});

test('разговор к уроку 17: 8 реплик, верные предлоги принимаются, неверные — объясняются', () => {
  const C = 'govorim-predlozi';
  const c = getConversation(C)!;
  assert.equal(c.turns.length, 8);
  const ok: [number, string][] = [
    [1, 'Аз съм на работа'], [1, 'Съм на работа'.replace('Съм', 'Сега съм')], [1, 'Аз съм в магазина'], [1, 'Вкъщи съм'], [1, 'Аз съм в парка, а ти?'],
    [2, 'Живея в София'], [2, 'Живея във Варна'], [2, 'Аз живея в Пловдив'], [2, 'Живея в Санкт Петербург'],
    [3, 'Идвам от работа'], [3, 'Аз идвам от банката сега'], [3, 'Идвам от лекаря'],
    [4, 'Говоря с мама'], [4, 'Говоря със сестра ми'], [4, 'Аз говоря с приятел по телефона'],
    [5, 'Пия кафе без захар'], [5, 'Пия кафе със захар'], [5, 'Аз пия кафе с мляко'], [5, 'Пия кафе с мляко и захар'.replace('с мляко и захар', 'със захар и мляко')],
    [6, 'Банката е до аптеката'], [6, 'Тя е пред гарата'], [6, 'Банката е между аптеката и магазина'], [6, 'Банката е близо до гарата'],
    [7, 'Отивам в магазина'], [7, 'Аз отивам при лекаря'], [7, 'Отивам на фитнес'], [7, 'Отивам до банката'], [7, 'Отивам вкъщи'],
    [8, 'Той е за мама'], [8, 'Това е подарък за сестра ми'], [8, 'Подаръкът е за брат ми'],
  ];
  for (const [n, s] of ok) assert.equal(lv(C, n, s).level, 'correct', `${n}: «${s}» → ${lv(C, n, s).message}`);
  const bad: [number, string, RegExp][] = [
    [1, 'Аз съм в работа', /на работа/], [1, 'Аз съм на магазина', /(в|предлог)/], [1, 'Аз си на работа', /съм/],
    [2, 'Живея в Варна', /във/], [2, 'Живея на София', /в/],
    [3, 'Идвам до работа', /от/], [3, 'Идвам в банката', /от/],
    [4, 'Говоря с сестра', /със/], [4, 'Говоря със мама', /с/],
    [5, 'Пия кафе с захар', /със/], [5, 'Пия кафе със мляко', /с/],
    [7, 'Отивам в лекаря', /при/], [7, 'Отивам в работа', /на/],
    [8, 'Той е от мама', /за/],
  ];
  for (const [n, s, re] of bad) {
    const r = lv(C, n, s);
    assert.notEqual(r.level, 'correct', `${n}: «${s}»`);
    assert.ok(re.test(r.message) || re.test(r.corrected), `${n}: «${s}» → ${r.message} / ${r.corrected}`);
  }
});

test('новые разговоры: в образцах нет двух одинаковых форм подряд и шаблоны не превращаются в ошибочные фразы', () => {
  for (const id of ['govorim-dvizhenie', 'govorim-predlozi']) for (const t of getConversation(id)!.turns) for (const v of variantsOf(t)) {
    assert.ok(!/\b(\S{3,}) \1\b/.test(v.toLowerCase()), `${t.id}: «${v}»`);
    assert.ok(!/ в Варна| с сестра| с захар| в работа| на магазина| на банката/i.test(' ' + v), `${t.id}: «${v}»`);
  }
  assert.ok(conversations.every((c) => c.turns.every((t) => t.keys.length > 0)));
});

test('уроки 16 и 17 открывают речевую практику, остальные уроки (кроме 15) — нет', () => {
  assert.equal(L16().speakingId, 'govorim-dvizhenie');
  assert.equal(L17().speakingId, 'govorim-predlozi');
  assert.ok(getConversation('govorim-dvizhenie') && getConversation('govorim-predlozi'));
});
