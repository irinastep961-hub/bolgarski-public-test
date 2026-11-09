import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBuild, checkText, levenshtein } from './answer';

const bg = { lang: 'bg' as const };
const ACC = ['Казвам се Ана.', 'Аз се казвам Ана.'];

test('верный ответ: пробелы, пунктуация и регистр не мешают', () => {
  assert.equal(checkText('Казвам се Ана.', ACC, bg).correct, true);
  assert.equal(checkText('  Казвам    се  Ана  ', ACC, bg).correct, true);
  assert.equal(checkText('Аз се казвам Ана', ACC, bg).correct, true);
});

test('регистр: верный ответ засчитывается, но выводится замечание', () => {
  const v = checkText('казвам се ана', ACC, bg);
  assert.equal(v.correct, true);
  assert.match(v.message ?? '', /регистр/);
  assert.match(v.message ?? '', /начинается с заглавной/);
  assert.match(v.message ?? '', /«Ана»/);
  assert.equal(checkText('Казвам се Ана', ACC, bg).message, undefined);
});

test('произвольные и «похожие по смыслу» ответы не принимаются', () => {
  assert.equal(checkText('Името ми е Мария.', ACC, bg).correct, false);
  assert.equal(checkText('Здравей', ACC, bg).correct, false);
  assert.equal(checkText('Казвам се', ACC, bg).correct, false);
  assert.equal(checkText('', ACC, bg).correct, false);
  assert.equal(checkText('   ', ACC, bg).correct, false);
});

test('порядок слов объясняется', () => {
  const v = checkText('Ана се казвам', ['Казвам се Ана.'], bg);
  assert.equal(v.correct, false);
  assert.match(v.message ?? '', /порядок слов/);
  const b = checkBuild(['сметката', 'ли', 'Може', 'моля'], [['Може', 'ли', 'сметката', 'моля']]);
  assert.equal(b.correct, false);
  assert.match(b.message ?? '', /порядок/);
});

test('сборка: дополнительные верные варианты порядка принимаются', () => {
  const variants = [['Може', 'ли', 'сметката', 'моля'], ['Моля', 'може', 'ли', 'сметката']];
  assert.equal(checkBuild(['Може', 'ли', 'сметката', 'моля'], variants).correct, true);
  assert.equal(checkBuild(['моля', 'Може', 'ли', 'сметката'], variants).correct, true);
});

test('не хватает слов, лишние слова, опечатки и другая форма', () => {
  assert.match(checkText('Казвам Ана', ['Казвам се Ана.'], bg).message ?? '', /Не хватает слов: «се»/);
  assert.match(checkText('Казвам се Ана много', ['Казвам се Ана.'], bg).message ?? '', /Лишние слова: «много»/);
  assert.match(checkText('Искам кафи', ['Искам кафе.'], bg).message ?? '', /написание: «кафи» → «кафе»/);
  assert.match(checkText('Може ли сметка', ['Може ли сметката.'], bg).message ?? '', /другая форма|написание/);
});

test('латиница и русские буквы ы/э/ё', () => {
  assert.match(checkText('Kazvam se Ana', ACC, bg).message ?? '', /латинские/);
  assert.match(checkText('Казвам сы Ана', ACC, bg).message ?? '', /нет букв «ы»/);
  assert.equal(checkText('Это дорого', ['Это дорого.'], { lang: 'ru' }).correct, true);
});

test('ловушки дают пояснение вместо общего разбора', () => {
  const traps = [
    { starts: 'се казвам', say: '«се» не ставится в начало фразы.' },
    { has: 'сметка', say: 'Нужен артикль: «сметката».' },
  ];
  assert.equal(checkText('Се казвам Ана', ACC, { ...bg, traps }).message, '«се» не ставится в начало фразы.');
  assert.equal(checkText('Може ли сметка', ['Може ли сметката'], { ...bg, traps }).message, 'Нужен артикль: «сметката».');
  // «сметката» — не ловушка «сметка» (целые слова)
  assert.equal(checkText('Може ли сметката', ['Може ли сметката'], { ...bg, traps }).correct, true);
});

test('русский перевод: ё/е и регистр равнозначны, замечаний о регистре нет', () => {
  const v = checkText('это дорого, но сыр дешевый', ['Это дорого, но сыр дешёвый.'], { lang: 'ru' });
  assert.equal(v.correct, true);
  assert.equal(v.message, undefined);
});

test('расстояние Левенштейна', () => {
  assert.equal(levenshtein('кафе', 'кафи'), 1);
  assert.equal(levenshtein('', 'аб'), 2);
});
