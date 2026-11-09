import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedForms, checkReply, expandTemplate, isEcho, politeForms, registerTraps, tidy, variantsOf } from './conversation';
import { matchesTrap } from './answer';
import { normalize } from './text';
import { conversations, getConversation } from '../content/conversations';
import type { Conversation, ConversationTurn } from '../types';

const conv = (id: string): Conversation => getConversation(id)!;
const turnOf = (cid: string, tid: string): ConversationTurn => conv(cid).turns.find((t) => t.id === tid)!;
const ctxOf = (c: Conversation) => ({ register: c.register ?? 'formal', partner: c.partner });
const reply = (cid: string, tid: string, text: string) => checkReply(turnOf(cid, tid), text, ctxOf(conv(cid)));

// -------------------------------------------------------------------- ресторан

test('ресторан: «Приятен апетит!» → «Благодаря!» полностью верно, без лишних подсказок', () => {
  const t = turnOf('kafe', 'kafe-4');
  assert.equal(t.them.bg, 'Заповядайте! Приятен апетит!');
  for (const a of ['Благодаря!', 'Благодаря', 'Благодаря много!', 'Много благодаря!', 'Благодаря ви', '  Благодаря   много ']) {
    const v = reply('kafe', 'kafe-4', a);
    assert.equal(v.level, 'correct', a);
    assert.equal(v.isNatural, true, `${a}: не должно предлагаться «так говорят чаще»`);
    assert.equal(v.message, 'Отлично!', a);
  }
  // маленькая буква не делает ответ неверным: он засчитывается, добавляется лишь замечание о регистре
  const lower = reply('kafe', 'kafe-4', 'благодаря много');
  assert.equal(lower.level, 'correct');
  assert.match(lower.message, /регистр/);
});

test('ресторан: «и на вас» не предлагается нигде в этой реплике', () => {
  const t = turnOf('kafe', 'kafe-4');
  assert.equal(t.natural, 'Благодаря!');
  const everything = [t.natural, ...(t.alsoNatural ?? []), ...variantsOf(t), ...acceptedForms(t), t.task, t.hint ?? '', t.note ?? '']
    .join(' ').toLowerCase();
  assert.ok(!everything.includes('и на вас'), 'в реплике встречается «и на вас»');
  const v = reply('kafe', 'kafe-4', 'Благодаря!');
  assert.ok(!(v.natural + v.corrected + v.message).toLowerCase().includes('и на вас'));
});

test('ресторан: если посетитель всё же добавил «и на вас», объясняется, что это не нужно', () => {
  const v = reply('kafe', 'kafe-4', 'Благодаря, и на вас');
  assert.equal(v.level, 'close');
  assert.match(v.message, /добавлять «и на вас» не нужно/);
  assert.ok(!v.corrected.toLowerCase().includes('и на вас'));
  assert.equal(reply('kafe', 'kafe-4', v.corrected).level, 'correct', 'исправленный вариант сам должен быть верным');
});

// -------------------------------------------------------------------- гибкая проверка

test('вежливое «моля» / «ако обичате» необязательно там, где оно входит в ответ', () => {
  for (const a of ['Едно кафе с мляко', 'Моля, едно кафе с мляко', 'Едно кафе с мляко, ако обичате', 'Искам едно кафе с мляко', 'Може ли кафе с мляко', 'Бих искала кафе с мляко, моля']) {
    assert.equal(reply('kafe', 'kafe-1', a).level, 'correct', a);
  }
  assert.equal(reply('kafe', 'kafe-1', 'моля').level === 'correct', false);
  assert.equal(reply('kafe', 'kafe-1', 'Едно кафе с мляко и сметана').level === 'correct', false);
  // там, где «моля» не часть сценария, «Благодаря, моля» верным не становится
  assert.equal(reply('kafe', 'kafe-4', 'Благодаря, моля').level === 'correct', false);
  assert.deepEqual(politeForms(['Благодаря.']), []);
});

test('естественные грамматически верные альтернативы принимаются', () => {
  const cases: [string, string, string][] = [
    ['magazin', 'magazin-1', 'Търся хляб'], ['magazin', 'magazin-1', 'Здравейте, искам хляб'], ['magazin', 'magazin-1', 'Бих искал хляб, моля'],
    ['magazin', 'magazin-2', 'Белия, моля'], ['magazin', 'magazin-3', 'Да, и един килограм ябълки'],
    ['magazin', 'magazin-4', 'Мога ли да платя с картата'],
    ['kafe', 'kafe-2', 'Не, благодаря'], ['kafe', 'kafe-5', 'Искам да платя'], ['kafe', 'kafe-6', 'С картата'],
    ['taksi', 'taksi-2', 'Само една чанта'], ['taksi', 'taksi-3', 'Колко ще платя'], ['taksi', 'taksi-3', 'Колко ще ми струва пътуването'],
    ['apteka', 'apteka-1', 'Имате ли лекарство за главоболие'], ['apteka', 'apteka-2', 'Нямам, за съжаление'], ['apteka', 'apteka-4', 'В брой'],
    ['sasedi', 'sasedi-1', 'Здравейте, аз съм Ана'], ['sasedi', 'sasedi-2', 'Аз съм от Русия, а вие?'],
    ['lekar', 'lekar-3', 'Температура нямам'], ['lekar', 'lekar-4', 'Алергии нямам'],
    ['obshtina', 'obshtina-1', 'Искам да попитам за документи'], ['obshtina', 'obshtina-2', 'Да, ето го'],
  ];
  for (const [c, t, a] of cases) assert.equal(reply(c, t, a).level, 'correct', `${t}: «${a}»`);
});

test('грамматика по-прежнему проверяется: неверные формы не засчитываются', () => {
  assert.notEqual(reply('magazin', 'magazin-1', 'Търся хляба').level, 'correct');
  assert.notEqual(reply('kafe', 'kafe-1', 'Искам една кафе с мляко').level, 'correct');
  assert.notEqual(reply('apteka', 'apteka-2', 'Не, имам рецепта').level, 'correct');
  assert.notEqual(reply('kafe', 'kafe-5', 'Може ли сметка').level, 'correct');
  assert.notEqual(reply('sasedi', 'sasedi-2', 'Съм от Русия').level, 'correct');
});

// -------------------------------------------------------------------- контекст и роли

test('роли: незнакомому человеку говорят на «вы»; ошибка объясняется с учётом собеседника', () => {
  const v = reply('magazin', 'magazin-1', 'Имаш ли хляб?');
  assert.equal(v.level, 'close');
  assert.match(v.message, /Собеседник — продавец: с ним говорят на «вы»/);
  assert.match(v.message, /вместо «имаш» нужно «имате»/i);
  assert.match(reply('kafe', 'kafe-1', 'Здравей, едно кафе с мляко').message, /«Здравей» — приветствие для друга/);
  assert.match(reply('maistor', 'maistor-1', 'Кранът ти тече').message, /Собеседник — мастер/);
});

test('роли: при обращении на «ты» (informal) такие ловушки не включаются', () => {
  assert.deepEqual(registerTraps({ register: 'informal' }), []);
  assert.ok(registerTraps({ register: 'formal', partner: 'Врач' }).length >= 5);
  const t = turnOf('magazin', 'magazin-1');
  const informal = checkReply(t, 'Имаш ли хляб?', { register: 'informal', partner: 'Друг' });
  assert.ok(!/на «вы»/.test(informal.message));
});

test('роли: повтор реплики собеседника не принимается и объясняется', () => {
  const v = reply('kafe', 'kafe-4', 'Приятен апетит');
  assert.equal(v.level, 'off');
  assert.match(v.message, /Это слова собеседника \(официант\), а отвечаете вы/);
  const v2 = reply('apteka', 'apteka-2', 'Имате ли рецепта?');
  assert.equal(v2.level, 'off');
  assert.match(v2.message, /Это слова собеседника \(фармацевт\)/);
});

test('ловушки обращения и роли не задевают ни один верный ответ ни в одном сценарии', () => {
  for (const c of conversations) for (const t of c.turns) {
    const forms = acceptedForms(t);
    assert.ok(forms.length >= 1 && forms.length <= 1500, `${t.id}: форм ${forms.length}`);
    const traps = [...(t.traps ?? []), ...registerTraps(ctxOf(c))];
    for (const f of forms) {
      assert.equal(traps.some((tr) => matchesTrap(normalize(f), tr)), false, `${t.id}: ловушка задевает «${f}»`);
      assert.equal(checkReply(t, f, ctxOf(c)).level, 'correct', `${t.id}: «${f}»`);
    }
    for (const n of [t.natural, ...(t.alsoNatural ?? []).flatMap((x) => expandTemplate(x).map(tidy))]) {
      assert.equal(checkReply(t, n, ctxOf(c)).level, 'correct', `${t.id}: естественный «${n}»`);
    }
    assert.ok(!/[A-Za-zыэёЫЭЁ]/.test(forms.join(' ')), `${t.id}: подозрительные буквы`);
  }
});

test('одиночное «моля» и пустые варианты не становятся верным ответом ни в одном сценарии', () => {
  for (const c of conversations) for (const t of c.turns) {
    assert.notEqual(checkReply(t, 'моля', ctxOf(c)).level, 'correct', t.id);
    assert.notEqual(checkReply(t, 'ако обичате', ctxOf(c)).level, 'correct', t.id);
  }
});

test('«эхо» реплики собеседника: целиком, частично; короткие обычные ответы не путаются с эхом', () => {
  assert.equal(isEcho('Приятен апетит', 'Заповядайте! Приятен апетит!'), true);
  assert.equal(isEcho('Заповядайте приятен апетит', 'Заповядайте! Приятен апетит!'), true);
  assert.equal(isEcho('Плащате ли в брой или с карта', 'Плащате ли в брой или с карта?'), true);
  assert.equal(isEcho('Благодаря', 'Заповядайте! Приятен апетит!'), false);
  assert.equal(isEcho('Приятен', 'Заповядайте! Приятен апетит!'), false); // одно слово — не эхо
  assert.equal(isEcho('В брой', 'Плащате ли в брой или с карта?'), false); // случайное совпадение двух слов — не эхо
  assert.notEqual(reply('kafe', 'kafe-6', 'В брой').message.slice(0, 30), 'Это слова собеседника (официант'); // ответ по теме, но не то, что просили
  assert.equal(isEcho('Ще платя с карта', 'Плащате ли в брой или с карта?'), false);
});
