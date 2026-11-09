import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySession, buildSession, createEmptyProgress, currentStreak, dateKey, dueWords, scoreSession, toggleWord,
} from './progress';
import type { ExerciseResult } from '../types';

const ok = (id: string, wordId?: string): ExerciseResult => ({ exerciseId: id, wordId, correct: true, attempts: 1 });
const bad = (id: string, wordId?: string): ExerciseResult => ({ exerciseId: id, wordId, correct: false, attempts: 2 });
const day = (n: number) => new Date(2026, 9, n, 12, 0, 0);

test('XP: за верные ответы и бонус за точность ≥ 80%', () => {
  assert.equal(scoreSession('lesson', [ok('1'), ok('2'), ok('3'), ok('4'), bad('5')]).xp, 4 * 2 + 10);
  assert.equal(scoreSession('lesson', [ok('1'), bad('2')]).xp, 2);
  assert.equal(scoreSession('review', [ok('1'), ok('2'), bad('3')]).xp, 2);
});

test('серия: растёт по дням подряд, сбрасывается после пропуска', () => {
  let p = createEmptyProgress();
  p = applySession(p, buildSession('lesson', [ok('1')], 'a', day(1)), [], day(1));
  p = applySession(p, buildSession('lesson', [ok('1')], 'a', day(1)), [], day(1));
  assert.equal(p.streak.current, 1);
  p = applySession(p, buildSession('lesson', [ok('1')], 'a', day(2)), [], day(2));
  assert.equal(p.streak.current, 2);
  assert.equal(currentStreak(p, dateKey(day(3))), 2);
  assert.equal(currentStreak(p, dateKey(day(5))), 0);
  p = applySession(p, buildSession('lesson', [ok('1')], 'a', day(5)), [], day(5));
  assert.equal(p.streak.current, 1);
  assert.equal(p.streak.longest, 2);
});

test('урок добавляет слова в словарь, повторение двигает коробки', () => {
  let p = createEmptyProgress();
  p = applySession(p, buildSession('lesson', [ok('1', 'kafe')], 'v-kafeneto', day(1)), ['kafe', 'chay'], day(1));
  assert.deepEqual(Object.keys(p.words).sort(), ['chay', 'kafe']);
  assert.equal(p.lessons['v-kafeneto'].completions, 1);
  assert.equal(dueWords(p, day(1)).length, 0);
  assert.equal(dueWords(p, day(2)).length, 2);

  p = applySession(p, buildSession('review', [ok('r1', 'kafe'), bad('r2', 'chay')], undefined, day(2)), [], day(2));
  assert.equal(p.words.kafe.box, 1);
  assert.equal(p.words.chay.box, 0);
  assert.equal(dueWords(p, day(2)).some((w) => w.wordId === 'kafe'), false);
  assert.equal(dueWords(p, day(2)).some((w) => w.wordId === 'chay'), true);
});

test('ручное добавление и удаление слова; исходный прогресс не мутируется', () => {
  const p0 = createEmptyProgress();
  const p1 = toggleWord(p0, 'bilet', day(1));
  assert.ok(p1.words.bilet);
  assert.equal(Object.keys(p0.words).length, 0);
  assert.equal(Object.keys(toggleWord(p1, 'bilet', day(1)).words).length, 0);
});

test('слова вечернего урока готовы к повторению следующим утром', () => {
  const evening = new Date(2026, 9, 1, 22, 30, 0);
  const morning = new Date(2026, 9, 2, 8, 0, 0);
  let p = applySession(createEmptyProgress(), buildSession('lesson', [ok('1', 'kafe')], 'v-kafeneto', evening), ['kafe'], evening);
  assert.equal(dueWords(p, evening).length, 0);
  assert.equal(dueWords(p, morning).length, 1);
  // верный ответ: коробка 1, интервал 1 день -> срок с начала следующих суток
  p = applySession(p, buildSession('review', [ok('r', 'kafe')], undefined, morning), [], morning);
  assert.equal(p.words.kafe.box, 1);
  assert.equal(dueWords(p, new Date(2026, 9, 2, 23, 59)).length, 0);
  assert.equal(dueWords(p, new Date(2026, 9, 3, 0, 1)).length, 1);
  // второй верный: коробка 2, интервал 3 дня
  const day3 = new Date(2026, 9, 3, 9, 0);
  p = applySession(p, buildSession('review', [ok('r2', 'kafe')], undefined, day3), [], day3);
  assert.equal(p.words.kafe.box, 2);
  assert.equal(dueWords(p, new Date(2026, 9, 5, 23, 0)).length, 0);
  assert.equal(dueWords(p, new Date(2026, 9, 6, 0, 1)).length, 1);
});
