'use client';

import { speak } from '@/lib/speech';
import { useVoices } from './useVoices';

export default function SpeakerButton({ text, big = false, label }: { text: string; big?: boolean; label?: string }) {
  const { status } = useVoices();
  const off = status === 'missing' || status === 'unsupported';
  const base = label ?? `Прослушать: ${text}`;
  return (
    <button
      type="button"
      className={'speaker' + (big ? ' big' : '') + (off ? ' off' : '')}
      aria-label={off ? `${base} (недоступно: нет болгарского голоса)` : base}
      onClick={() => {
        void speak(text);
      }}
    >
      🔊
    </button>
  );
}
