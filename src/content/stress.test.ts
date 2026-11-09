import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACUTE, PRONUNCIATION_CHECK, STRESS, stressed } from './stress';
import { words } from './words';
import { getStressHints, setStressHints } from '../lib/voicePrefs';
import { speakWith, type SpeechEngine, type VoiceLike } from '../lib/speech';
import { SPEECH_HINT_WORDS, applySpeechHints, speechText } from './ttsHints';

const VOWELS = 'аъоуеиюя';

test('«благодаря» — ударение на последнем слоге: благодаря́', () => {
  assert.equal(stressed('благодаря'), 'благодаря' + ACUTE);
  assert.equal(stressed('Благодаря'), 'благодаря' + ACUTE);
  assert.equal(STRESS['благодаря'].normalize('NFC').endsWith('я' + ACUTE), true);
});

test('таблица ударений: корректный формат', () => {
  const keys = Object.keys(STRESS);
  assert.ok(keys.length >= 50, `слов: ${keys.length}`);
  for (const [plain, accented] of Object.entries(STRESS)) {
    assert.equal(accented.split(ACUTE).join(''), plain, plain);
    for (const word of accented.split(' ')) {
      const marks = word.split(ACUTE).length - 1;
      assert.ok(marks <= 1, `${plain}: в слове «${word}» больше одного знака ударения`);
      const i = word.indexOf(ACUTE);
      if (i >= 0) assert.ok(VOWELS.includes(word[i - 1]), `${plain}: знак стоит не после гласной в «${word}»`);
      const bare = word.split(ACUTE).join('');
      const vowelCount = [...bare].filter((ch) => VOWELS.includes(ch)).length;
      if (vowelCount === 1) assert.equal(marks, 0, `${plain}: в односложном «${bare}» ударение не отмечают`);
    }
  }
});

test('слова для проверки озвучки есть и в словаре, и в таблице ударений', () => {
  for (const bg of PRONUNCIATION_CHECK) {
    assert.ok(stressed(bg), `нет ударения: ${bg}`);
    assert.ok(words.some((w) => w.bg === bg), `нет в словаре: ${bg}`);
  }
});

test('слова без подсказки уходят в голос без изменений (знак ударения не добавляется)', async () => {
  const IVAN: VoiceLike = { name: 'Microsoft Ivan - Bulgarian (Bulgaria)', lang: 'bg-BG', voiceURI: 'ivan' };
  const spoken: string[] = [];
  const engine: SpeechEngine = { getVoices: () => [IVAN], speak: (text) => void spoken.push(text), cancelIfBusy: () => {} };
  const prepare = (t: string) => speechText(t, true);
  for (const w of ['здравей', 'моля', 'кафе', 'метро', 'Добър ден! Казвам се Ана.']) await speakWith(engine, w, { prepare });
  assert.deepEqual(spoken, ['здравей', 'моля', 'кафе', 'метро', 'Добър ден! Казвам се Ана.']);
  assert.ok(spoken.every((t) => !t.includes(ACUTE)));
});

test('в карточках слов озвучивается обычный текст слова, а не «ударная» запись', () => {
  for (const f of ['src/components/LessonFlow.tsx', 'src/app/words/page.tsx']) {
    const src = readFileSync(f, 'utf-8');
    assert.ok(src.includes('<SpeakerButton text={w.bg}'), `${f}: озвучивание слова`);
    assert.ok(!/SpeakerButton text=\{stressed/.test(src), `${f}: в голос нельзя передавать слово со знаком ударения`);
  }
});

const IVAN: VoiceLike = { name: 'Microsoft Ivan - Bulgarian (Bulgaria)', lang: 'bg-BG', voiceURI: 'ivan' };
const capture = () => {
  const spoken: string[] = [];
  const engine: SpeechEngine = { getVoices: () => [IVAN], speak: (text) => void spoken.push(text), cancelIfBusy: () => {} };
  return { spoken, engine };
};

// Ударения, сверенные пользователем с носителем языка. Для банкомат, превод и благодаря носитель отдельно не подтверждал — они оставлены как были.
const EXPECTED: Record<string, string> = {
  'благодаря': 'благодаря́',
  'подстригване': 'подстри́гване', 'боядисване': 'бояди́сване', 'прическа': 'при́ческа', 'коса': 'коса́', 'по-късо': 'по-късо́', 'свободен': 'свобо́ден',
  'обувки': 'обувки́', 'да върна': 'да върна́',
  'банкомат': 'банкома́т', 'пари': 'пари́', 'превод': 'пре́вод', 'да платя': 'да платя́',
  'интересно': 'интере́сно',
};

test('таблица ударений совпадает с утверждённым списком', () => {
  for (const [plain, accented] of Object.entries(EXPECTED)) assert.equal(stressed(plain), accented, plain);
});

test('в голос уходит слово со знаком ударения ровно в утверждённом месте (через фактический путь speakWith)', async () => {
  for (const [plain, accented] of Object.entries(EXPECTED)) {
    const { spoken, engine } = capture();
    await speakWith(engine, plain, { prepare: (t) => speechText(t, true) });
    assert.deepEqual(spoken, [accented], plain);
    assert.equal(spoken[0].replace(ACUTE, ''), plain, 'кроме знака ударения текст не меняется');
  }
});

test('«благодаря» получает ударение на последнем слоге во всех местах: слово, фраза, диалог, регистр', () => {
  for (const t of ['Благодаря!', 'Благодаря много!', 'Благодаря ви, довиждане.', 'Не, благодаря. Само подстригване.', 'БЛАГОДАРЯ']) {
    const out = applySpeechHints(t);
    assert.ok(/[яЯ]\u0301/.test(out), t);
    assert.equal(out.split(ACUTE).join(''), t);
  }
  assert.equal(applySpeechHints('Благодаря много!'), 'Благодаря' + ACUTE + ' много!');
});

test('подсказка есть и в примерах, и в предложениях уроков 11–14 (слова внутри фраз)', () => {
  assert.equal(applySpeechHints('Мога ли да върна тези обувки?'), 'Мога ли да върна' + ACUTE + ' тези обувки' + ACUTE + '?');
  assert.equal(applySpeechHints('Може ли да платя сметката?'), 'Може ли да платя' + ACUTE + ' сметката?');
  assert.equal(applySpeechHints('Нямам пари в брой.'), 'Нямам пари' + ACUTE + ' в брой.');
  assert.equal(applySpeechHints('Много е интересно!'), 'Много е интере' + ACUTE + 'сно!');
});

test('подсказка не трогает другие формы слов и слова с похожим началом', () => {
  for (const t of ['парите', 'косата', 'обувките', 'свободно', 'превода', 'благодарение', 'парк', 'парижки', 'карти']) assert.equal(applySpeechHints(t), t, t);
});

test('слова уроков 1–10 (кроме «благодаря») передаются голосу без изменений', () => {
  const touched = new Set(SPEECH_HINT_WORDS);
  for (const w of words) {
    if (touched.has(w.bg)) continue;
    assert.equal(applySpeechHints(w.bg), w.bg, w.bg);
  }
});

test('подсказку можно выключить: тогда текст уходит без знака', () => {
  assert.equal(speechText('благодаря', false), 'благодаря');
  assert.equal(speechText('благодаря', true), 'благодаря' + ACUTE);
});

test('по умолчанию в голос уходит слово БЕЗ знака ударения (подсказка выключена)', async () => {
  assert.equal(getStressHints(), false);
  for (const key of SPEECH_HINT_WORDS) {
    const { spoken, engine } = capture();
    await speakWith(engine, key, { prepare: (t) => speechText(t, getStressHints()) });
    assert.deepEqual(spoken, [key], key);
  }
  setStressHints(true);
  assert.equal(getStressHints(), true);
  setStressHints(false);
  assert.equal(getStressHints(), false);
});

test('в speak() подсказка подключена, а на экран знак ударения не попадает через подсказку', () => {
  const sp = readFileSync('src/lib/speech.ts', 'utf-8');
  assert.ok(sp.includes('speechText(t, hintsOn)') && sp.includes('getStressHints()'));
  for (const f of ['src/components/SpeakerButton.tsx', 'src/components/LessonFlow.tsx', 'src/app/words/page.tsx']) {
    assert.ok(!/applySpeechHints|speechText/.test(readFileSync(f, 'utf-8')), `${f}: подсказка должна добавляться только в speak()`);
  }
});

test('все слова списка подсказок есть в словаре курса, а «благодаря» — в уроке 1', () => {
  for (const key of SPEECH_HINT_WORDS) assert.ok(words.some((w) => w.bg === key), key);
});
