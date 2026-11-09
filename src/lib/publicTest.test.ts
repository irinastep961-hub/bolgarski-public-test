import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lessons } from '../content';
import { conversations } from '../content/conversations';
import { FEEDBACK_URL, FREE_LESSONS_COUNT, LOCKED_CONVERSATION_IDS, feedbackLink, freeLessonIds, isConversationFree, isLessonFree } from '../config/publicTest';

const root = new URL('../../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), 'utf8');

test('открыты ровно первые 10 уроков, уроки 11–17 закрыты, контент не тронут (17 уроков)', () => {
  assert.equal(lessons.length, 17);
  assert.equal(FREE_LESSONS_COUNT, 10);
  assert.deepEqual(freeLessonIds, lessons.slice(0, 10).map((l) => l.id));
  for (const l of lessons.slice(0, 10)) assert.ok(isLessonFree(l.id), l.id);
  for (const l of lessons.slice(10)) assert.ok(!isLessonFree(l.id), l.id);
  assert.deepEqual(lessons.slice(10).map((l) => l.id).slice(-3), ['glagol-sam', 'glagoli-dvizhenie', 'predlozi']);
});

test('закрытые разговорные сценарии существуют; сценарии первых уроков открыты; практика уроков 15–17 закрыта', () => {
  const ids = new Set(conversations.map((c) => c.id));
  for (const id of LOCKED_CONVERSATION_IDS) assert.ok(ids.has(id), id);
  for (const id of ['govorim-sam', 'govorim-dvizhenie', 'govorim-predlozi']) assert.ok(!isConversationFree(id));
  const free = conversations.filter((c) => isConversationFree(c.id));
  assert.equal(free.length, conversations.length - LOCKED_CONVERSATION_IDS.length);
  assert.ok(free.length >= 10);
  // закрытые уроки не ведут на открытую практику
  for (const l of lessons.slice(10)) if (l.speakingId) assert.ok(!isConversationFree(l.speakingId), l.id);
});

test('кнопка отзыва: ссылка на Facebook задана, открывается в новой вкладке; принимаются только https-ссылки', () => {
  assert.equal(FEEDBACK_URL, 'https://www.facebook.com/profile.php?id=100004611274369');
  assert.equal(feedbackLink(), FEEDBACK_URL);
  assert.ok(!/появится позже/.test(read('src/components/FeedbackBox.tsx')));
  assert.ok(/target="_blank"/.test(read('src/components/FeedbackBox.tsx')));
  assert.equal(feedbackLink('   '), null);
  assert.equal(feedbackLink('http://facebook.com/x'), null);
  assert.equal(feedbackLink('javascript:alert(1)'), null);
  assert.equal(feedbackLink('https://www.facebook.com/example'), 'https://www.facebook.com/example');
  const box = read('src/components/FeedbackBox.tsx');
  assert.ok(box.includes('Оставить отзыв в Facebook'));
  assert.ok(/disabled/.test(box));
  assert.ok(box.includes('noopener noreferrer'));
});

test('приветственная страница: название, девиз, «тренажёр, а не учебник», предупреждение об озвучивании, отзыв', () => {
  const cfg = read('src/config/publicTest.ts');
  assert.ok(cfg.includes("'Болгарский без страха'"));
  assert.ok(cfg.includes("'Практикуйся. Повторяй. Начинай говорить'"));
  const w = read('src/app/welcome/page.tsx');
  assert.match(w, /тренажёр для практики, а не полноценный учебник/);
  assert.match(w, /ошибается в произношении и ударениях/);
  assert.match(w, /FeedbackBox/);
  assert.match(w, /Регистрация, пароль и оплата/);
  assert.match(read('src/app/page.tsx'), /router\.replace\('\/welcome'\)/);
});

test('нет регистрации, паролей, оплаты и сбора e-mail: ни полей ввода почты/пароля, ни mailto, ни форм', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  for (const f of walk(join(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f))) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/type=["']?(email|password)/i.test(s), f);
    assert.ok(!/mailto:/i.test(s), f);
    assert.ok(!/<form[\s>]/i.test(s), f);
    assert.ok(!/(stripe|paypal|paddle|checkout)/i.test(s), f);
  }
});

test('закрытые уроки и сценарии не открываются по прямой ссылке (серверная проверка в страницах)', () => {
  assert.match(read('src/app/lesson/[id]/page.tsx'), /!isLessonFree\(id\)/);
  assert.match(read('src/app/speaking/[id]/page.tsx'), /!isConversationFree\(id\)/);
  assert.match(read('src/app/page.tsx'), /!isLessonFree\(l\.id\)/);
  assert.match(read('src/app/speaking/page.tsx'), /!isConversationFree\(c\.id\)/);
});

test('название приложения в метаданных, манифесте и service worker', () => {
  assert.match(read('src/app/layout.tsx'), /title: 'Болгарский без страха'/);
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, 'Болгарский без страха');
  assert.match(read('public/sw.js'), /bolgarski-public-test-v5/);
  assert.match(read('src/config/publicTest.ts'), /BUILD_LABEL = '.*v5/);
});

test('блоки отзыва: тексты, ссылка и условия показа', () => {
  const fb = read('src/components/FeedbackBox.tsx');
  assert.match(fb, /Как вам задания\? Нашли ошибку или хотите что-то предложить\?/);
  assert.match(fb, /Удалось потренироваться говорить\? Поделитесь впечатлениями!/);
  assert.match(fb, /target="_blank" rel="noopener noreferrer"/);
  const flow = read('src/components/LessonFlow.tsx');
  assert.match(flow, /isLessonFree\(lesson\.id\)/);
  assert.match(flow, /kind="practice"/);
  assert.doesNotMatch(flow, /kind="speech"/); // на экране урока речевого блока нет
  assert.match(read('src/components/conversation/ConversationPlayer.tsx'), /kind="speech"/);
  assert.doesNotMatch(read('src/app/page.tsx'), /FeedbackBox/);
  assert.match(read('src/app/welcome/page.tsx'), /<FeedbackBox \/>/);
  assert.match(flow, /<FeedbackBox context=/); // блок во введении остался
});

test('у каждого бесплатного урока есть речевая часть (диалоги)', async () => {
  const { lessons } = await import('../content');
  for (const l of lessons.slice(0, 10)) assert.ok(l.exercises.some((e) => e.type === 'dialog'), l.id);
});

test('блок отзыва во введении стоит до списка слов, после слов его нет', () => {
  const flow = read('src/components/LessonFlow.tsx');
  const fb = flow.indexOf('<FeedbackBox context=');
  const words = flow.indexOf('Слова урока');
  assert.ok(fb > 0 && fb < words);
  assert.equal(flow.slice(words).includes('<FeedbackBox context='), false);
  assert.equal(read('src/app/words/page.tsx').includes('FeedbackBox'), false);
});
