import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReply, expandTemplate, tidy, variantsOf, MAX_VARIANTS } from './conversation';
import { applyConversation, conversationXp, createEmptyProgress, TURN_XP_FIRST, TURN_XP_RETRY, turnXp } from './progress';
import { conversations } from '../content/conversations';
import { normalize } from './text';
import type { ConversationTurn, ConversationTurnResult } from '../types';

const turn = (over: Partial<ConversationTurn> = {}): ConversationTurn => ({
  id: 't', them: { bg: 'Как се казвате?', ru: 'Как вас зовут?' }, task: 'Скажите, что вас зовут Ана.',
  accepted: ['{Добър ден, |}{казвам се|аз се казвам} Ана'], natural: 'Казвам се Ана.', keys: ['казва', 'ана'],
  traps: [{ starts: 'се казвам', say: '«се» не может стоять в начале фразы.' }], ...over,
});

test('шаблоны раскрываются, пустой вариант допустим', () => {
  assert.deepEqual(expandTemplate('{а|б|}в'), ['ав', 'бв', 'в']);
  assert.equal(expandTemplate('{1|2}{3|4}{5|6}').length, 8);
  assert.deepEqual(expandTemplate('без шаблона'), ['без шаблона']);
  assert.throws(() => expandTemplate('{1|2|3|4|5|6|7|8|9|0}{1|2|3|4|5|6|7|8|9|0}{1|2|3|4|5}'));
});

test('tidy: пробелы, знаки, заглавная, точка', () => {
  assert.equal(tidy(', добър ден , казвам се Ана'), 'Добър ден, казвам се Ана.');
  assert.equal(tidy('може ли сметката?'), 'Може ли сметката?');
  assert.equal(tidy('  '), '');
});

test('верные ответы: разные формулировки, регистр, пробелы', () => {
  for (const a of ['Казвам се Ана', 'казвам се ана', '  Аз  се  казвам   Ана! ', 'Добър ден, казвам се Ана', 'Казвам се Ана.']) {
    assert.equal(checkReply(turn(), a).level, 'correct', a);
  }
  assert.equal(checkReply(turn(), 'Казвам се Ана.').isNatural, true);
  assert.equal(checkReply(turn(), 'Аз се казвам Ана').isNatural, false);
  assert.match(checkReply(turn(), 'казвам се ана').message, /регистр/);
});

test('естественная фраза всегда принимается', () => {
  const t = turn({ accepted: ['Привет'], natural: 'Добър вечер! Казвам се Ана. Приятно ми е.' });
  assert.equal(checkReply(t, 'Добър вечер! Казвам се Ана. Приятно ми е.').level, 'correct');
});

test('близкий ответ: объяснение и исправленный вариант', () => {
  const v = checkReply(turn(), 'Казвам Ана');
  assert.equal(v.level, 'close');
  assert.match(v.message, /Не хватает слов/);
  assert.equal(v.corrected, 'Казвам се Ана.');
  const trap = checkReply(turn(), 'Се казвам Ана');
  assert.equal(trap.level, 'close');
  assert.equal(trap.message, '«се» не может стоять в начале фразы.');
});

test('не по теме, русский текст, латиница, пустой ввод', () => {
  const off = checkReply(turn(), 'Колко струва хлябът във вторник');
  assert.equal(off.level, 'off');
  assert.match(off.message, /Сейчас нужно: Скажите, что вас зовут Ана/);
  assert.equal(checkReply(turn(), 'Меня зовут Ана').level === 'correct', false);
  const latin = checkReply(turn(), 'Kazvam se Ana');
  assert.equal(latin.level, 'close');
  assert.match(latin.message, /латинские/);
  assert.equal(checkReply(turn(), '   ').level, 'empty');
});

test('честность: неподготовленная, но верная фраза не выдаётся за «верную»', () => {
  // «Името ми е Ана» есть в шаблоне, а «Аз се наричам Ана» — нет: система не делает вид, что понимает
  const v = checkReply(turn(), 'Аз се наричам Ана');
  assert.notEqual(v.level, 'correct');
});

test('XP: 3 за первую попытку, 1 за исправление', () => {
  assert.equal(turnXp(1), TURN_XP_FIRST);
  assert.equal(turnXp(2), TURN_XP_RETRY);
  assert.equal(turnXp(5), TURN_XP_RETRY);
});

const res = (id: string, xp: number, level: ConversationTurnResult['level'] = 'correct', attempts = 1): ConversationTurnResult => ({ turnId: id, attempts, level, xp });

test('прогресс диалога: XP начисляется один раз, повтор XP не даёт', () => {
  const now = new Date(2026, 9, 5, 12);
  let p = createEmptyProgress();
  const results = [res('a', 3), res('b', 1, 'correct', 2), res('c', 0, 'close', 2)];
  assert.equal(conversationXp(p, 'conv', results), 4);
  p = applyConversation(p, 'conv', results, now);
  assert.equal(p.xp, 4);
  assert.equal(p.xpByDate['2026-10-05'], 4);
  assert.equal(p.streak.current, 1);
  assert.deepEqual(p.conversations.conv.rewardedTurns.sort(), ['a', 'b']);
  assert.equal(p.conversations.conv.completions, 1);
  assert.equal(p.conversations.conv.bestCorrect, 2);
  // то же самое ещё раз: XP не растёт, но диалог засчитан
  assert.equal(conversationXp(p, 'conv', results), 0);
  const again = applyConversation(p, 'conv', results, now);
  assert.equal(again.xp, 4);
  assert.equal(again.conversations.conv.completions, 2);
  // реплика, за которую раньше XP не было, теперь даёт XP
  const better = applyConversation(again, 'conv', [res('a', 3), res('b', 3), res('c', 3)], now);
  assert.equal(better.xp, 4 + 3);
  assert.equal(better.conversations.conv.bestCorrect, 3);
});

test('прогресс диалога не трогает уроки, словарь и историю; исходные данные не меняются', () => {
  const p0 = createEmptyProgress();
  const snapshot = JSON.stringify(p0);
  const p1 = applyConversation(p0, 'conv', [res('a', 3)], new Date(2026, 9, 5));
  assert.equal(JSON.stringify(p0), snapshot);
  assert.deepEqual(p1.lessons, {});
  assert.deepEqual(p1.words, {});
  assert.deepEqual(p1.history, []);
});

test('старое сохранение без поля conversations работает', () => {
  const legacy = JSON.parse(JSON.stringify(createEmptyProgress()));
  delete legacy.conversations;
  const merged = { ...createEmptyProgress(), ...legacy };
  assert.deepEqual(merged.conversations, {});
  const p = applyConversation({ ...legacy } as never, 'conv', [res('a', 3)], new Date(2026, 9, 5));
  assert.equal(p.xp, 3);
});

// ----------------------------------------------------------------- контент

test('сценарии: 18 ситуаций, диалоги по 5–6 реплик (речевая практика уроков 15–17 — 8–10)', () => {
  assert.deepEqual(conversations.map((c) => c.id), ['sasedi', 'magazin', 'apteka', 'kafe', 'taksi', 'lekar', 'maistor', 'obshtina', 'pazar', 'do-centara', 'pokana-kafe', 'parikmaher', 'obleklo', 'banka', 'razgovor-priyatel', 'govorim-sam', 'govorim-dvizhenie', 'govorim-predlozi']);
  for (const c of conversations) {
    const [min, max] = c.id.startsWith('govorim-') ? [8, 10] : [5, 6];
    assert.ok(c.turns.length >= min && c.turns.length <= max, `${c.id}: ${c.turns.length} реплик`);
    assert.ok(c.title && c.situation && c.partner && c.emoji, c.id);
  }
  const ids = conversations.flatMap((c) => c.turns.map((t) => t.id));
  assert.equal(new Set(ids).size, ids.length, 'повторяются id реплик');
});

const ctxOf = (c: (typeof conversations)[number]) => ({ register: c.register ?? ('formal' as const), partner: c.partner });

test('сценарии: каждый вариант ответа проходит проверку, число вариантов в норме', () => {
  for (const c of conversations) for (const t of c.turns) {
    const variants = variantsOf(t);
    assert.ok(variants.length >= 1 && variants.length <= MAX_VARIANTS, `${t.id}: вариантов ${variants.length}`);
    for (const v of variants) {
      assert.equal(checkReply(t, v, ctxOf(c)).level, 'correct', `${t.id}: «${v}»`);
      assert.ok(!/^[\s,.!?]/.test(v) && !/\s{2}/.test(v) && !/\s[,.!?]/.test(v), `${t.id}: некрасивый вариант «${v}»`);
    }
    assert.equal(checkReply(t, t.natural, ctxOf(c)).level, 'correct', `${t.id}: естественная фраза`);
    assert.ok(t.task && t.them.bg && t.them.ru && t.keys.length > 0, t.id);
    // подсказка не должна выдавать ответ целиком
    if (t.hint) assert.ok(!normalize(t.hint).includes(normalize(t.natural)), `${t.id}: подсказка выдаёт готовый ответ`);
  }
});

test('сценарии: ловушки срабатывают и не задевают верные ответы', () => {
  for (const c of conversations) for (const t of c.turns) for (const trap of t.traps ?? []) {
    const sample = trap.has ?? `${trap.starts} много`;
    const v = checkReply(t, sample, ctxOf(c));
    assert.notEqual(v.level, 'correct', `${t.id}: ловушка «${sample}» принята как верный ответ`);
    assert.equal(v.level, 'close', `${t.id}: «${sample}»`);
  }
});

test('сценарии: бессмыслица, русский текст и ответ другой реплики не засчитываются', () => {
  for (const c of conversations) c.turns.forEach((t, i) => {
    assert.notEqual(checkReply(t, 'пълен абсурд тук', ctxOf(c)).level, 'correct', t.id);
    assert.notEqual(checkReply(t, t.task, ctxOf(c)).level, 'correct', `${t.id}: русская задача как ответ`);
    assert.equal(checkReply(t, '').level, 'empty');
    const other = c.turns[(i + 2) % c.turns.length];
    const stolen = checkReply(t, other.natural, ctxOf(c));
    const sameAnswer = variantsOf(t).map(normalize).includes(normalize(other.natural));
    if (!sameAnswer) assert.notEqual(stolen.level, 'correct', `${t.id}: принят ответ из ${other.id}`);
  });
});

test('сценарии: в болгарском тексте нет латиницы и русских «ы, э, ё»', () => {
  const bad = /[A-Za-zыэёЫЭЁ]/;
  for (const c of conversations) for (const t of c.turns) {
    for (const s of [t.them.bg, t.natural, ...variantsOf(t)]) assert.ok(!bad.test(s), `${t.id}: «${s}»`);
    assert.ok(!/[A-Za-z]/.test(t.them.ru + t.task + (t.note ?? '')), `${t.id}: латиница в русском тексте`);
  }
});
