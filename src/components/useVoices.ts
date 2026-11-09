'use client';

import { useSyncExternalStore } from 'react';
import { getPreferredVoice, setPreferredVoice } from '@/lib/voicePrefs';
import { browserEngine, listBulgarianVoices, normalizeLang, pickVoice } from '@/lib/speech';

export type VoiceStatus = 'checking' | 'ready' | 'missing' | 'unsupported';

export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export interface VoiceState {
  status: VoiceStatus;
  /** Только болгарские голоса, лучшие первыми */
  voices: VoiceInfo[];
  selectedURI: string | null;
  /** Сколько всего голосов видит браузер и на каких языках (для диагностики) */
  total: number;
  langs: Record<string, number>;
}

const INITIAL: VoiceState = { status: 'checking', voices: [], selectedURI: null, total: 0, langs: {} };
const WAIT_MS = 2500;

let state: VoiceState = INITIAL;
let started = false;
let timedOut = false;
const listeners = new Set<() => void>();

function emit(next: VoiceState) {
  state = next;
  listeners.forEach((l) => l());
}

function refresh() {
  const engine = browserEngine();
  if (!engine) {
    emit({ ...INITIAL, status: 'unsupported' });
    return;
  }
  const all = engine.getVoices();
  const langs: Record<string, number> = {};
  for (const v of all) {
    const l = normalizeLang(v.lang) || '—';
    langs[l] = (langs[l] ?? 0) + 1;
  }
  const bg = listBulgarianVoices(all);
  const chosen = pickVoice(all, getPreferredVoice());
  const status: VoiceStatus = bg.length > 0 ? 'ready' : all.length === 0 && !timedOut ? 'checking' : 'missing';
  emit({
    status,
    voices: bg.map((v) => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI, localService: v.localService })),
    selectedURI: chosen?.voiceURI ?? null,
    total: all.length,
    langs,
  });
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', refresh);
  refresh();
  setTimeout(() => {
    timedOut = true;
    refresh();
  }, WAIT_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

/** Запомнить выбранный пользователем болгарский голос */
export function selectVoice(uri: string): void {
  setPreferredVoice(uri);
  refresh();
}

export function useVoices(): VoiceState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}
