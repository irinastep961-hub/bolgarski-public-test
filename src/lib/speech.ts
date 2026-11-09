import { getPreferredVoice, getStressHints } from './voicePrefs';
import { speechText } from '../content/ttsHints';

// Озвучивание болгарского текста.
// Главное правило: говорим ТОЛЬКО настоящим болгарским голосом (язык bg / bg-BG).
// Если такого голоса нет, не говорим вообще — никакой подмены русским или другим голосом.
// Раньше при отсутствии голоса браузер сам брал голос по умолчанию (на русской Windows — русский),
// и болгарский текст читался с русской фонетикой.

export const VOICE_MISSING_MESSAGE = 'Болгарский голос озвучивания не найден на этом устройстве';
export const SPEECH_UNSUPPORTED_MESSAGE = 'Этот браузер не умеет озвучивать текст. Попробуйте Chrome или Edge.';

export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService?: boolean;
}

export type SpeakResult = 'ok' | 'no-voice' | 'unsupported' | 'empty';

/** Минимальный интерфейс движка озвучивания (в тестах заменяется имитацией). */
export interface SpeechEngine<V extends VoiceLike = VoiceLike> {
  getVoices(): V[];
  speak(text: string, voice: V, rate: number): void;
  cancelIfBusy(): void;
}

export function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, '-');
}

/** Болгарский голос определяется только по языковому тегу, а не по названию. */
export function isBulgarianVoice(v: VoiceLike): boolean {
  const l = normalizeLang(v.lang);
  return l === 'bg' || l.startsWith('bg-');
}

function quality(v: VoiceLike): number {
  if (/natural|online/i.test(v.name)) return 3;
  if (/google/i.test(v.name)) return 2;
  return 1;
}

/** Болгарские голоса, лучшие первыми; при равенстве сохраняется исходный порядок. */
export function listBulgarianVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => isBulgarianVoice(v))
    .sort((a, b) => quality(b.v) - quality(a.v) || a.i - b.i)
    .map(({ v }) => v);
}

/** Выбранный пользователем голос (если он ещё есть и он болгарский), иначе лучший болгарский. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], preferredURI?: string | null): T | undefined {
  const bg = listBulgarianVoices(voices);
  if (preferredURI) {
    const chosen = bg.find((v) => v.voiceURI === preferredURI || v.name === preferredURI);
    if (chosen) return chosen;
  }
  return bg[0];
}

export interface SpeakOptions<V extends VoiceLike> {
  preferredURI?: string | null;
  rate?: number;
  /** Асинхронная загрузка списка голосов (в Chrome он появляется не сразу). */
  loadVoices?: () => Promise<V[]>;
  /** Подготовка текста для голоса (подсказки ударения). По умолчанию текст передаётся без изменений. */
  prepare?: (text: string) => string;
}

export async function speakWith<V extends VoiceLike>(
  engine: SpeechEngine<V> | null,
  text: string,
  opts: SpeakOptions<V> = {},
): Promise<SpeakResult> {
  if (!engine) return 'unsupported';
  if (!text.trim()) return 'empty';
  const voices = opts.loadVoices ? await opts.loadVoices() : engine.getVoices();
  const voice = pickVoice(voices, opts.preferredURI);
  if (!voice) return 'no-voice';
  engine.cancelIfBusy();
  engine.speak(opts.prepare ? opts.prepare(text) : text, voice, opts.rate ?? 0.85);
  return 'ok';
}

// ---------------------------------------------------------------- браузер

export function browserEngine(): SpeechEngine<SpeechSynthesisVoice> | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const synth = window.speechSynthesis;
  return {
    getVoices: () => synth.getVoices(),
    cancelIfBusy() {
      if (synth.speaking || synth.pending) synth.cancel();
    },
    speak(text, voice, rate) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; // голос задан всегда
      u.lang = voice.lang; // язык берётся у самого голоса (bg-BG), а не «по умолчанию»
      u.rate = rate;
      synth.speak(u);
    },
  };
}

export function canSpeak(): boolean {
  return browserEngine() !== null;
}

/** Ждёт появления списка голосов (в Chrome getVoices() сначала бывает пустым). */
export function waitForVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([]);
    const synth = window.speechSynthesis;
    if (synth.getVoices().length > 0) return resolve(synth.getVoices());
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', onChange);
      resolve(synth.getVoices());
    };
    const onChange = () => {
      if (synth.getVoices().length > 0) finish();
    };
    synth.addEventListener('voiceschanged', onChange);
    setTimeout(finish, timeoutMs);
  });
}

export const VOICE_PROBLEM_EVENT = 'bolgarski:voice-problem';

function reportVoiceProblem(reason: SpeakResult): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VOICE_PROBLEM_EVENT, { detail: { reason } }));
}

/**
 * Произносит болгарский текст выбранным болгарским голосом.
 * При отсутствии голоса ничего не произносит и (если не quiet) показывает сообщение.
 */
export async function speak(text: string, opts: { quiet?: boolean; hints?: boolean } = {}): Promise<SpeakResult> {
  const hintsOn = opts.hints ?? getStressHints();
  const result = await speakWith(browserEngine(), text, {
    preferredURI: getPreferredVoice(),
    loadVoices: waitForVoices,
    prepare: (t) => speechText(t, hintsOn), // на экране остаётся обычное написание, подсказка уходит только в голос
  });
  if ((result === 'no-voice' || result === 'unsupported') && !opts.quiet) reportVoiceProblem(result);
  return result;
}
