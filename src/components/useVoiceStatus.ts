'use client';

import { useVoices } from './useVoices';

/** Краткий статус для старых экранов: 'missing' — болгарского голоса нет (или озвучивание не поддерживается). */
export function useVoiceStatus(): 'unknown' | 'ok' | 'missing' {
  const { status } = useVoices();
  if (status === 'ready') return 'ok';
  if (status === 'checking') return 'unknown';
  return 'missing';
}
