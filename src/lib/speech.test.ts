import test from 'node:test';
import assert from 'node:assert/strict';
import { isBulgarianVoice, listBulgarianVoices, pickVoice, speakWith, type SpeechEngine, type VoiceLike } from './speech';

const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({ name, lang, voiceURI: name, ...extra });
const IRINA = v('Microsoft Irina - Russian (Russia)', 'ru-RU');
const DAVID = v('Microsoft David - English (United States)', 'en-US');
const IVAN = v('Microsoft Ivan - Bulgarian (Bulgaria)', 'bg-BG');
const KALINA = v('Microsoft Kalina Online (Natural) - Bulgarian (Bulgaria)', 'bg-BG', { localService: false });

function fake(voices: VoiceLike[]) {
  const spoken: { text: string; voice: VoiceLike; rate: number }[] = [];
  let cancelled = 0;
  const engine: SpeechEngine = {
    getVoices: () => voices,
    speak: (text, voice, rate) => void spoken.push({ text, voice, rate }),
    cancelIfBusy: () => void cancelled++,
  };
  return { engine, spoken, cancelled: () => cancelled };
}

test('болгарский голос определяется по языку, а не по названию', () => {
  for (const lang of ['bg-BG', 'bg_BG', 'BG-bg', 'bg', ' bg-BG ']) assert.equal(isBulgarianVoice(v('x', lang)), true, lang);
  for (const lang of ['ru-RU', 'en-US', 'uk-UA', 'sr-RS', 'mk-MK', '']) assert.equal(isBulgarianVoice(v('x', lang)), false, lang);
  // название «Bulgarian», но язык русский — это не болгарский голос
  assert.equal(isBulgarianVoice(v('Bulgarian Voice', 'ru-RU')), false);
});

test('нет болгарского голоса: русский голос НЕ используется, речь не запускается', async () => {
  const { engine, spoken } = fake([IRINA, DAVID, v('Bulgarian Voice', 'ru-RU')]);
  assert.equal(await speakWith(engine, 'Здравейте', {}), 'no-voice');
  assert.equal(spoken.length, 0, 'ничего не должно быть произнесено');
});

test('пустой список голосов и неподдерживаемый браузер', async () => {
  const empty = fake([]);
  assert.equal(await speakWith(empty.engine, 'Здравейте'), 'no-voice');
  assert.equal(empty.spoken.length, 0);
  assert.equal(await speakWith(null, 'Здравейте'), 'unsupported');
});

test('есть болгарский голос: говорит именно им, даже если русский идёт первым', async () => {
  const { engine, spoken } = fake([IRINA, IVAN, DAVID]);
  assert.equal(await speakWith(engine, 'Здравейте'), 'ok');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].voice, IVAN);
  assert.equal(isBulgarianVoice(spoken[0].voice), true);
});

test('выбор голоса: запомненный голос используется, устаревший и неболгарский игнорируются', async () => {
  assert.equal(pickVoice([IVAN, KALINA], KALINA.voiceURI), KALINA);
  assert.equal(pickVoice([IVAN, KALINA], 'нет такого'), KALINA); // лучший: Natural
  assert.equal(pickVoice([IRINA, IVAN], IRINA.voiceURI), IVAN); // русский выбрать нельзя
  assert.equal(pickVoice([IRINA], IRINA.voiceURI), undefined);
  const { engine, spoken } = fake([IVAN, KALINA]);
  await speakWith(engine, 'Добър ден', { preferredURI: IVAN.voiceURI });
  assert.equal(spoken[0].voice, IVAN);
});

test('порядок болгарских голосов: Natural/Online, затем Google, затем остальные; стабильно', () => {
  const g = v('Google български', 'bg-BG');
  const other = v('Другой', 'bg-BG');
  assert.deepEqual(listBulgarianVoices([other, g, KALINA, IRINA]).map((x) => x.name), [KALINA.name, g.name, other.name]);
});

test('голоса загружаются позже: ждём список и не берём голос по умолчанию', async () => {
  const { engine, spoken } = fake([]);
  const late = await speakWith(engine, 'Здравейте', { loadVoices: async () => [IRINA, IVAN] });
  assert.equal(late, 'ok');
  assert.equal(spoken[0].voice, IVAN);
  const none = fake([]);
  assert.equal(await speakWith(none.engine, 'Здравейте', { loadVoices: async () => [IRINA] }), 'no-voice');
  assert.equal(none.spoken.length, 0);
});

test('пустой текст не озвучивается', async () => {
  const { engine, spoken } = fake([IVAN]);
  assert.equal(await speakWith(engine, '   '), 'empty');
  assert.equal(spoken.length, 0);
});

test('перед новой фразой прерывается предыдущая, скорость умеренная', async () => {
  const f = fake([IVAN]);
  await speakWith(f.engine, 'Здравейте');
  assert.equal(f.cancelled(), 1);
  assert.ok(f.spoken[0].rate > 0 && f.spoken[0].rate <= 1);
});
