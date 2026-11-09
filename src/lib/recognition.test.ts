import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTranscript, getRecognitionCtor, mapRecognitionError, recognitionErrorMessage, startRecognition,
  RECOGNITION_LANG, type RecognitionCtor, type RecognitionEventLike, type RecognitionLike,
} from './recognition';

class FakeRec implements RecognitionLike {
  static last: FakeRec | undefined;
  static failOnStart = false;
  lang = ''; interimResults = false; continuous = true; maxAlternatives = 0;
  onstart: (() => void) | null = null; onresult: ((e: RecognitionEventLike) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
  started = false; stopped = false; aborted = false;
  constructor() { FakeRec.last = this; }
  start() { if (FakeRec.failOnStart) throw new Error('InvalidStateError'); this.started = true; this.onstart?.(); }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.aborted = true; }
}
const Ctor = FakeRec as unknown as RecognitionCtor;
const ev = (parts: [string, boolean][]): RecognitionEventLike => ({
  resultIndex: 0,
  results: Object.assign(parts.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })), {}) as never,
});

test('поддержка определяется по SpeechRecognition или webkitSpeechRecognition', () => {
  assert.equal(getRecognitionCtor(undefined), undefined);
  assert.equal(getRecognitionCtor({}), undefined);
  assert.equal(getRecognitionCtor({ webkitSpeechRecognition: Ctor }), Ctor);
  assert.equal(getRecognitionCtor({ SpeechRecognition: Ctor }), Ctor);
});

test('запуск: язык bg-BG, промежуточные результаты, одна фраза', () => {
  const texts: [string, boolean][] = []; let ended = 0; let started = 0;
  const s = startRecognition(Ctor, { onStart: () => started++, onText: (t, f) => texts.push([t, f]), onError: () => assert.fail(), onEnd: () => ended++ });
  assert.ok(s);
  const r = FakeRec.last!;
  assert.equal(r.lang, 'bg-BG');
  assert.equal(RECOGNITION_LANG, 'bg-BG');
  assert.equal(r.interimResults, true);
  assert.equal(r.continuous, false);
  assert.equal(started, 1);
  r.onresult!(ev([['казвам', false]]));
  r.onresult!(ev([['казвам се Ана', true]]));
  assert.deepEqual(texts, [['казвам', false], ['казвам се Ана', true]]);
  s!.stop();
  assert.equal(r.stopped, true);
  assert.equal(ended, 1);
});

test('ошибки: нет доступа к микрофону объясняется, текстовый режим остаётся', () => {
  const errors: [string, string][] = [];
  startRecognition(Ctor, { onText: () => {}, onError: (k, m) => errors.push([k, m]), onEnd: () => {} });
  FakeRec.last!.onerror!({ error: 'not-allowed' });
  FakeRec.last!.onerror!({ error: 'service-not-allowed' });
  FakeRec.last!.onerror!({ error: 'no-speech' });
  FakeRec.last!.onerror!({ error: 'audio-capture' });
  FakeRec.last!.onerror!({ error: 'network' });
  FakeRec.last!.onerror!({ error: 'aborted' }); // отмена пользователем — не ошибка
  assert.deepEqual(errors.map((e) => e[0]), ['not-allowed', 'not-allowed', 'no-speech', 'audio-capture', 'network']);
  assert.match(errors[0][1], /Доступ к микрофону запрещён/);
  assert.match(errors[0][1], /печатать ответ/);
  for (const [, m] of errors) assert.ok(m.length > 20 && /[а-я]/i.test(m));
  assert.equal(mapRecognitionError('что-то странное'), 'other');
  assert.match(recognitionErrorMessage('language-not-supported'), /болгарск/);
});

test('сбой при запуске (уже запущено и т. п.) не роняет приложение', () => {
  FakeRec.failOnStart = true;
  let got = '';
  const s = startRecognition(Ctor, { onText: () => {}, onError: (k) => (got = k), onEnd: () => {} });
  FakeRec.failOnStart = false;
  assert.equal(s, null);
  assert.equal(got, 'other');
});

test('распознанный текст собирается из нескольких частей', () => {
  assert.deepEqual(extractTranscript(ev([['Здравейте', true], ['  как сте ', true]])), { text: 'Здравейте как сте', final: true });
  assert.equal(extractTranscript(ev([['Здравейте', true], ['как', false]])).final, false);
  assert.deepEqual(extractTranscript(ev([])), { text: '', final: false });
});
