// Выбор голоса хранится отдельно от прогресса (прогресс и его формат не затрагиваются).
const KEY = 'bolgarski:voice:v1';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getPreferredVoice(): string | null {
  return store()?.getItem(KEY) ?? null;
}

export function setPreferredVoice(uri: string | null): void {
  try {
    if (uri) store()?.setItem(KEY, uri);
    else store()?.removeItem(KEY);
  } catch {
    /* хранилище недоступно — выбор просто не запомнится */
  }
}

// Подсказки ударения для голоса. По умолчанию ВЫКЛЮЧЕНЫ.
// Причина: знак ударения U+0301 в тексте болгарские голоса Windows не понимают как ударение — часть слов
// после этого звучала хуже (например, «боядисване»). Включать можно только для проверки на слух
// на странице «Озвучивание».
const HINTS_KEY = 'bolgarski:voice:stress-hints:v2';

let hintsInMemory: boolean | null = null; // если хранилище недоступно, выбор действует до закрытия страницы

export function getStressHints(): boolean {
  if (hintsInMemory !== null) return hintsInMemory;
  return store()?.getItem(HINTS_KEY) === 'on';
}

export function setStressHints(on: boolean): void {
  hintsInMemory = on;
  try {
    if (on) store()?.setItem(HINTS_KEY, 'on');
    else store()?.removeItem(HINTS_KEY);
  } catch {
    /* хранилище недоступно — выбор не запомнится между запусками */
  }
}
