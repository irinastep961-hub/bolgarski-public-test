// Настройки публичной тестовой версии «Болгарский без страха».
// Содержимое уроков не менялось: тестовая версия лишь закрывает часть из них.
import { lessons } from '@/content';

export const APP_NAME = 'Болгарский без страха';
export const APP_MOTTO = 'Практикуйся. Повторяй. Начинай говорить';

/** Сколько первых уроков открыто бесплатно для всех */
export const FREE_LESSONS_COUNT = 10;

/** Страница в Facebook для отзывов и сообщений об ошибках (открывается в новой вкладке) */
export const FEEDBACK_URL = 'https://www.facebook.com/profile.php?id=100004611274369';

/** Разговорные сценарии, относящиеся к урокам 11–17: в тестовой версии закрыты */
export const LOCKED_CONVERSATION_IDS: string[] = [
  'parikmaher', 'obleklo', 'banka', 'razgovor-priyatel', 'govorim-sam', 'govorim-dvizhenie', 'govorim-predlozi',
];

export const freeLessonIds: string[] = lessons.slice(0, FREE_LESSONS_COUNT).map((l) => l.id);
export const isLessonFree = (id: string): boolean => freeLessonIds.includes(id);
export const isConversationFree = (id: string): boolean => !LOCKED_CONVERSATION_IDS.includes(id);

/** Метка сборки: по ней видно, какая версия открыта в браузере */
export const BUILD_LABEL = 'Тестовая версия · сборка 7.11.2026 · v5 (отзыв: приветствие, введение, задания, речь)';

/** Безопасная ссылка на отзывы: только https, иначе кнопка остаётся неактивной */
export function feedbackLink(url: string = FEEDBACK_URL): string | null {
  const u = url.trim();
  return /^https:\/\/[^\s]+$/.test(u) ? u : null;
}

export const WELCOME_KEY = 'bolgarski:welcome-seen:v1';
