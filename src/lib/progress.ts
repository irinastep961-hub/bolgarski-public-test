// Чистая логика прогресса: без React и без хранилища — её легко тестировать
// и переиспользовать при переходе на облачную синхронизацию.
import type {
  ConversationTurnResult, ExerciseResult, ID, Progress, SessionKind, SessionResult, Streak, WordState,
} from '../types';

/** Интервалы повторения (дни) для коробок Лейтнера 0..5 */
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];
export const MAX_BOX = REVIEW_INTERVAL_DAYS.length - 1;
export const DEFAULT_DAILY_GOAL = 30;

export function createEmptyProgress(): Progress {
  return {
    version: 1,
    xp: 0,
    dailyGoalXp: DEFAULT_DAILY_GOAL,
    xpByDate: {},
    streak: { current: 0, longest: 0, lastActiveDate: null },
    lessons: {},
    words: {},
    history: [],
    conversations: {},
  };
}

/** Локальная дата в формате YYYY-MM-DD */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

/** 0 дней — сразу; N дней — с начала (местной) даты через N дней, чтобы вечерние слова ждали утром. */
function dueAtFrom(now: Date, days: number): string {
  if (days <= 0) return now.toISOString();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).toISOString();
}

export function currentStreak(p: Progress, today: string): number {
  const last = p.streak.lastActiveDate;
  if (!last) return 0;
  return last === today || last === shiftDateKey(today, -1) ? p.streak.current : 0;
}

function bumpStreak(s: Streak, today: string): Streak {
  if (s.lastActiveDate === today) return s;
  const current = s.lastActiveDate === shiftDateKey(today, -1) ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastActiveDate: today };
}

export function todayXp(p: Progress, today: string): number {
  return p.xpByDate[today] ?? 0;
}

export function lastDays(p: Progress, count: number, today: string): { date: string; xp: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = shiftDateKey(today, i - (count - 1));
    return { date, xp: p.xpByDate[date] ?? 0 };
  });
}

export function scoreSession(kind: SessionKind, results: ExerciseResult[]) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const xp = kind === 'lesson' ? correct * 2 + (total > 0 && correct / total >= 0.8 ? 10 : 0) : correct;
  return { total, correct, xp };
}

export function buildSession(
  kind: SessionKind, results: ExerciseResult[], lessonId?: ID, now: Date = new Date(),
): SessionResult {
  return { kind, lessonId, finishedAt: now.toISOString(), results, ...scoreSession(kind, results) };
}

function newWordState(wordId: ID, now: Date, delayDays: number): WordState {
  return { wordId, box: 0, dueAt: dueAtFrom(now, delayDays), addedAt: now.toISOString(), seen: 0, correct: 0, wrong: 0 };
}

export function applySession(
  p: Progress, s: SessionResult, lessonWordIds: ID[] = [], now: Date = new Date(),
): Progress {
  const next = structuredClone(p);
  const today = dateKey(now);

  next.xp += s.xp;
  next.xpByDate[today] = (next.xpByDate[today] ?? 0) + s.xp;
  next.streak = bumpStreak(next.streak, today);

  if (s.kind === 'lesson' && s.lessonId) {
    const prev = next.lessons[s.lessonId];
    const accuracy = s.total ? s.correct / s.total : 0;
    next.lessons[s.lessonId] = {
      completions: (prev?.completions ?? 0) + 1,
      bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
      lastCompletedAt: s.finishedAt,
    };
    // Слова пройденного урока автоматически попадают в личный словарь (первое повторение — завтра)
    for (const id of lessonWordIds) if (!next.words[id]) next.words[id] = newWordState(id, now, 1);
  }

  for (const r of s.results) {
    const w = r.wordId ? next.words[r.wordId] : undefined;
    if (!w) continue;
    w.seen += 1;
    if (r.correct) w.correct += 1; else w.wrong += 1;
    if (s.kind === 'review') {
      w.box = r.correct ? Math.min(MAX_BOX, w.box + 1) : 0;
      w.dueAt = dueAtFrom(now, REVIEW_INTERVAL_DAYS[w.box]);
    }
  }

  const { results: _details, ...summary } = s;
  next.history = [...next.history, summary].slice(-100);
  return next;
}

/** Добавить слово в личный словарь или убрать из него */
export function toggleWord(p: Progress, wordId: ID, now: Date = new Date()): Progress {
  const next = structuredClone(p);
  if (next.words[wordId]) delete next.words[wordId];
  else next.words[wordId] = newWordState(wordId, now, 0);
  return next;
}

export function dueWords(p: Progress, now: Date = new Date()): WordState[] {
  return Object.values(p.words)
    .filter((w) => new Date(w.dueAt).getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function setDailyGoal(p: Progress, xp: number): Progress {
  return { ...p, dailyGoalXp: xp };
}

// ---------------------------------------------------------------- разговорная практика

/** XP за реплику: верно с первой попытки / верно после исправления */
export const TURN_XP_FIRST = 3;
export const TURN_XP_RETRY = 1;

export function turnXp(attempts: number): number {
  return attempts <= 1 ? TURN_XP_FIRST : TURN_XP_RETRY;
}

/** Сколько XP будет начислено: только за реплики, за которые XP ещё не начислялся. */
export function conversationXp(p: Progress, conversationId: ID, results: ConversationTurnResult[]): number {
  const rewarded = new Set(p.conversations?.[conversationId]?.rewardedTurns ?? []);
  return results.filter((r) => r.xp > 0 && !rewarded.has(r.turnId)).reduce((sum, r) => sum + r.xp, 0);
}

/** Сохраняет завершённый диалог. Повторное прохождение XP за те же реплики не даёт. */
export function applyConversation(
  p: Progress, conversationId: ID, results: ConversationTurnResult[], now: Date = new Date(),
): Progress {
  const next = structuredClone(p);
  next.conversations = next.conversations ?? {};
  const prev = next.conversations[conversationId];
  const gained = conversationXp(p, conversationId, results);
  const today = dateKey(now);

  next.xp += gained;
  next.xpByDate[today] = (next.xpByDate[today] ?? 0) + gained;
  next.streak = bumpStreak(next.streak, today);

  const rewarded = new Set(prev?.rewardedTurns ?? []);
  for (const r of results) if (r.xp > 0) rewarded.add(r.turnId);
  const correct = results.filter((r) => r.level === 'correct').length;
  next.conversations[conversationId] = {
    completions: (prev?.completions ?? 0) + 1,
    bestCorrect: Math.max(prev?.bestCorrect ?? 0, correct),
    lastCompletedAt: now.toISOString(),
    rewardedTurns: [...rewarded],
  };
  return next;
}
