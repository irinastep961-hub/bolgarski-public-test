import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkReply, variantsOf } from './conversation';
import { tokens } from './answer';
import { normalize } from './text';
import { conversations, getConversation } from '../content/conversations';
import { lessons } from '../content/index';

const conv = getConversation('govorim-sam')!;
const ctx = { register: 'informal' as const, partner: conv.partner };
const turn = (n: number) => conv.turns[n - 1];
const lvl = (n: number, s: string) => checkReply(turn(n), s, ctx).level;

test('речевая практика урока 15: 8–10 вопросов, на «ты», у каждого перевод, задание и естественный ответ', () => {
  assert.ok(conv.turns.length >= 8 && conv.turns.length <= 10);
  assert.equal(conv.register, 'informal');
  for (const t of conv.turns) {
    assert.ok(t.them.bg && t.them.ru && t.task && t.natural, t.id);
    assert.equal(checkReply(t, t.natural, ctx).level, 'correct', t.id);
  }
});

test('речевая практика: вопросы из задания присутствуют', () => {
  const qs = conv.turns.map((t) => normalize(t.them.bg)).join(' | ');
  for (const q of ['как си днес', 'откъде си', 'студент ли си', 'свободна ли си днес', 'уморена ли си', 'ти доволна ли си от живота в българия', 'какви са твоите приятели']) {
    assert.ok(qs.includes(q), q);
  }
});

test('речевая практика: встречаются все формы «съм» в ответах и вопросах', () => {
  const forms = { съм: 0, си: 0, е: 0, сме: 0, сте: 0, са: 0 } as Record<string, number>;
  for (const t of conv.turns) {
    const toks = new Set([...variantsOf(t), t.them.bg].flatMap((v) => tokens(v)));
    for (const f of Object.keys(forms)) if (toks.has(f)) forms[f]++;
  }
  for (const [f, n] of Object.entries(forms)) assert.ok(n > 0, `форма «${f}» не встречается`);
  // формы именно в ответах ученика
  const own = new Set(conv.turns.flatMap((t) => variantsOf(t).flatMap((v) => tokens(v))));
  for (const f of ['съм', 'е', 'сме', 'сте', 'са']) assert.ok(own.has(f), `в ответах нет «${f}»`);
});

test('речевая практика: есть утверждения, отрицания и вопросы с «ли»', () => {
  const all = conv.turns.flatMap((t) => variantsOf(t).map((v) => tokens(v)));
  assert.ok(all.some((a) => a.includes('не') && a.includes('съм')), 'нет отрицаний');
  assert.ok(all.some((a) => a.includes('ли') && a.includes('сте')), 'нет вопросов с «ли» от ученика');
  assert.ok(conv.turns.filter((t) => tokens(t.them.bg).includes('ли')).length >= 4, 'мало вопросов с «ли»');
});

test('речевая практика: принимаются разные верные ответы (род, порядок слов, «да/нет», хвосты)', () => {
  assert.equal(lvl(3, 'Да, студентка съм'), 'correct');
  assert.equal(lvl(3, 'да студент съм'), 'correct');
  assert.equal(lvl(3, 'Аз съм студентка'), 'correct');
  assert.equal(lvl(3, 'Не, не съм студентка, работя'), 'correct');
  assert.equal(lvl(4, 'Свободна съм днес'), 'correct');
  assert.equal(lvl(4, 'Не, днес не съм свободна'), 'correct');
  assert.equal(lvl(4, 'Да, свободен съм. А ти свободен ли си?'), 'correct');
  assert.equal(lvl(5, 'Не, не съм уморена'), 'correct');
  assert.equal(lvl(5, 'Много съм уморен'), 'correct');
  assert.equal(lvl(6, 'Не съм много доволна от живота в България'), 'correct');
  assert.equal(lvl(6, 'Да, много съм доволна'), 'correct');
  assert.equal(lvl(7, 'Приятелите ми са интересни'), 'correct');
  assert.equal(lvl(8, 'Там е топло'), 'correct');
  assert.equal(lvl(9, 'Добри приятели сме'), 'correct');
  assert.equal(lvl(10, 'Вие от Варна ли сте?'), 'correct');
  assert.equal(lvl(10, 'Здравейте! От Варна ли сте'), 'correct');
  assert.equal(lvl(1, 'Добре съм'), 'correct');
  assert.equal(lvl(1, 'Не съм много добре'), 'correct');
});

test('речевая практика: неверная форма «съм» не засчитывается и объясняется', () => {
  const bad: [number, string, RegExp][] = [
    [1, 'Аз си добре', /съм/],
    [3, 'Не си студентка', /не съм/i],
    [7, 'Те е добри', /са/],
    [7, 'Те съм добри', /са/],
    [9, 'Ние съм добри приятели', /сме/],
    [10, 'Вие си от Варна ли', /сте/],
    [10, 'Вие от Варна ли си', /сте/],
  ];
  for (const [n, said, re] of bad) {
    const r = checkReply(turn(n), said, ctx);
    assert.notEqual(r.level, 'correct', said);
    assert.match(r.message, re, said);
  }
});

test('речевая практика: пустой ответ, эхо и чужая тема — понятное сообщение, повтор возможен', () => {
  assert.equal(checkReply(turn(2), '   ', ctx).level, 'empty');
  const echo = checkReply(turn(3), 'Студент ли си', ctx);
  assert.notEqual(echo.level, 'correct');
  const off = checkReply(turn(5), 'Искам кафе и вода', ctx);
  assert.equal(off.level, 'off');
  assert.ok(off.corrected && off.message);
});

test('речевая практика: подключена к уроку 15, остальные уроки не затронуты', () => {
  const l15 = lessons.find((l) => l.id === 'glagol-sam')!;
  assert.equal(l15.speakingId, 'govorim-sam');
  assert.ok(getConversation(l15.speakingId!));
  for (const l of lessons) if (!['glagol-sam', 'glagoli-dvizhenie', 'predlozi'].includes(l.id)) assert.equal(l.speakingId, undefined, l.id);
  const flow = readFileSync(new URL('../components/LessonFlow.tsx', import.meta.url), 'utf8');
  assert.ok(flow.includes('/speaking/${lesson.speakingId}'));
});

test('речевая практика: используется общий голосовой ввод, нового микрофонного кода нет', () => {
  const player = readFileSync(new URL('../components/conversation/ConversationPlayer.tsx', import.meta.url), 'utf8');
  assert.ok(player.includes("import VoiceInput from './VoiceInput'"));
  const flow = readFileSync(new URL('../components/LessonFlow.tsx', import.meta.url), 'utf8');
  assert.ok(!/SpeechRecognition|getUserMedia|startRecognition/.test(flow));
  assert.equal(conversations.filter((c) => c.id === 'govorim-sam').length, 1);
});
