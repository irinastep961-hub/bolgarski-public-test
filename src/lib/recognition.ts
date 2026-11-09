// Голосовой ввод через встроенное в браузер распознавание речи (Web Speech API).
// Мы НЕ имитируем распознавание: если браузер его не поддерживает или доступ к микрофону
// запрещён, пользователь получает понятное объяснение и остаётся текстовый режим.

export const RECOGNITION_LANG = 'bg-BG';

export const RECOGNITION_UNSUPPORTED_MESSAGE =
  'Этот браузер не поддерживает голосовой ввод. Откройте приложение в Chrome или Edge либо пользуйтесь текстовым режимом.';

export const RECOGNITION_PRIVACY_NOTE =
  'Распознавание выполняет сам браузер. В Chrome и Edge звук обрабатывается службой разработчика браузера через интернет; приложение звук не записывает, не сохраняет и никуда не отправляет.';

export type RecognitionErrorKind =
  | 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'language-not-supported' | 'aborted' | 'other';

export interface RecognitionAlternative { transcript: string; confidence?: number }
export interface RecognitionResultLike { isFinal: boolean; length: number; [index: number]: RecognitionAlternative }
export interface RecognitionEventLike { resultIndex: number; results: { length: number; [index: number]: RecognitionResultLike } }

export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;
export interface RecognitionHost { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }

export function getRecognitionCtor(host: RecognitionHost | undefined): RecognitionCtor | undefined {
  return host?.SpeechRecognition ?? host?.webkitSpeechRecognition;
}

export function mapRecognitionError(code: string): RecognitionErrorKind {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'no-speech':
    case 'audio-capture':
    case 'network':
    case 'language-not-supported':
    case 'aborted':
      return code;
    default:
      return 'other';
  }
}

export function recognitionErrorMessage(kind: RecognitionErrorKind): string {
  switch (kind) {
    case 'not-allowed':
      return 'Доступ к микрофону запрещён. Разрешите микрофон для этого сайта (значок настроек слева от адреса) и нажмите запись снова. Пока можно печатать ответ.';
    case 'no-speech':
      return 'Речь не распознана. Говорите ближе к микрофону и повторите запись.';
    case 'audio-capture':
      return 'Микрофон не найден или занят другой программой. Проверьте подключение или пользуйтесь текстовым режимом.';
    case 'network':
      return 'Нет связи со службой распознавания: в Chrome и Edge она работает через интернет. Проверьте соединение или печатайте ответ.';
    case 'language-not-supported':
      return 'Этот браузер не умеет распознавать болгарскую речь. Пользуйтесь текстовым режимом.';
    default:
      return 'Не удалось распознать речь. Повторите запись или печатайте ответ.';
  }
}

/** Собирает распознанный текст из результатов события */
export function extractTranscript(ev: RecognitionEventLike): { text: string; final: boolean } {
  const parts: string[] = [];
  let final = ev.results.length > 0;
  for (let i = 0; i < ev.results.length; i++) {
    const r = ev.results[i];
    if (r.length > 0) parts.push(r[0].transcript);
    if (!r.isFinal) final = false;
  }
  return { text: parts.join(' ').replace(/\s+/g, ' ').trim(), final };
}

export interface RecognitionHandlers {
  onStart?(): void;
  onText(text: string, final: boolean): void;
  onError(kind: RecognitionErrorKind, message: string): void;
  onEnd(): void;
}

export interface RecognitionSession { stop(): void; abort(): void }

/** Запускает распознавание болгарской речи (bg-BG). Возвращает null, если запустить не удалось. */
export function startRecognition(Ctor: RecognitionCtor, h: RecognitionHandlers): RecognitionSession | null {
  let rec: RecognitionLike;
  try {
    rec = new Ctor();
    rec.lang = RECOGNITION_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => h.onStart?.();
    rec.onresult = (e) => {
      const { text, final } = extractTranscript(e);
      if (text) h.onText(text, final);
    };
    rec.onerror = (e) => {
      const kind = mapRecognitionError(e.error);
      if (kind !== 'aborted') h.onError(kind, recognitionErrorMessage(kind));
    };
    rec.onend = () => h.onEnd();
    rec.start();
  } catch {
    h.onError('other', recognitionErrorMessage('other'));
    return null;
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}
