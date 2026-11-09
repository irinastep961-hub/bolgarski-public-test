'use client';

import { useEffect, useState } from 'react';
import { SPEECH_UNSUPPORTED_MESSAGE, VOICE_MISSING_MESSAGE, VOICE_PROBLEM_EVENT } from '@/lib/speech';

/** Короткое сообщение, когда озвучить текст нельзя (нет болгарского голоса). */
export default function VoiceToast() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onProblem = (e: Event) => {
      const r = (e as CustomEvent<{ reason: string }>).detail?.reason ?? 'no-voice';
      setReason(r);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setReason(null), 8000);
    };
    window.addEventListener(VOICE_PROBLEM_EVENT, onProblem);
    return () => {
      window.removeEventListener(VOICE_PROBLEM_EVENT, onProblem);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!reason) return null;
  return (
    <div className="toast" role="alert">
      <div>
        <strong>{reason === 'unsupported' ? SPEECH_UNSUPPORTED_MESSAGE : VOICE_MISSING_MESSAGE}</strong>
        <p>Русским голосом болгарский текст не читается. Как установить голос: «Успехи» → «Озвучивание».</p>
      </div>
      <button type="button" className="toast-close" aria-label="Закрыть сообщение" onClick={() => setReason(null)}>✕</button>
    </div>
  );
}
