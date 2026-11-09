'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getRecognitionCtor, RECOGNITION_PRIVACY_NOTE, RECOGNITION_UNSUPPORTED_MESSAGE, recognitionErrorMessage, startRecognition,
  type RecognitionHost, type RecognitionSession,
} from '@/lib/recognition';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

/** Голосовой ввод: запись → распознанный текст (можно править) → проверка. Ничего не имитируется. */
export default function VoiceInput({ value, onChange, onSubmit, disabled }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<RecognitionSession | null>(null);
  // за эту запись пришёл текст / сообщена ошибка (чтобы тихий конец записи не остался без объяснения)
  const heard = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor(window as unknown as RecognitionHost)));
    return () => session.current?.abort();
  }, []);

  const toggle = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor(window as unknown as RecognitionHost);
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
    heard.current = false;
    failed.current = false;
    onChange(''); // новая запись заменяет прежний текст
    session.current = startRecognition(Ctor, {
      onStart: () => setListening(true),
      onText: (t) => {
        heard.current = true;
        onChange(t);
      },
      onError: (_kind, message) => {
        failed.current = true;
        setError(message);
        setListening(false);
      },
      onEnd: () => {
        if (!heard.current && !failed.current) setError(recognitionErrorMessage('no-speech'));
        setListening(false);
        session.current = null;
      },
    });
    if (session.current) setListening(true);
  };

  const blocked = disabled || supported !== true;
  return (
    <div className="voice">
      {supported === false && <p className="notice" role="alert">{RECOGNITION_UNSUPPORTED_MESSAGE}</p>}
      <button
        type="button"
        className={'mic' + (listening ? ' on' : '')}
        disabled={blocked}
        onClick={toggle}
        aria-label={listening ? 'Остановить запись' : 'Начать запись голосом'}
      >
        {listening ? '⏹' : '🎤'}
      </button>
      <p className="mic-status" aria-live="polite">
        {listening ? 'Слушаю… говорите по-болгарски' : value ? 'Проверьте распознанный текст и при необходимости исправьте' : 'Нажмите на микрофон и скажите ответ'}
      </p>
      {error && <p className="notice" role="alert">{error}</p>}
      <label className="tip" htmlFor="voice-text">Распознанный текст (можно исправить)</label>
      <textarea
        id="voice-text"
        className="input"
        rows={3}
        value={value}
        disabled={disabled}
        placeholder="Здесь появится распознанный текст"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="row">
        <button type="button" className="btn light" disabled={blocked || listening} onClick={toggle}>Записать заново</button>
        <button type="button" className="btn" disabled={disabled || listening || !value.trim()} onClick={onSubmit}>Проверить</button>
      </div>
      <p className="tip">{RECOGNITION_PRIVACY_NOTE}</p>
    </div>
  );
}
