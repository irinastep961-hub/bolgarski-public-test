'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { lessons } from '@/content';
import { APP_MOTTO, APP_NAME, FREE_LESSONS_COUNT, WELCOME_KEY, isLessonFree } from '@/config/publicTest';
import { useProgress } from '@/components/ProgressProvider';
import { currentStreak, dateKey, dueWords, todayXp } from '@/lib/progress';

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const share = Math.min(1, value / goal);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`Цель дня: ${value} из ${goal} XP`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#d3e4ea" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="#f5b83d" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - share)} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="800" fill="#14283a">{value}</text>
    </svg>
  );
}

export default function HomePage() {
  const { progress } = useProgress();
  const router = useRouter();
  // Первый визит: показываем приветственную страницу (если хранилище недоступно — просто остаёмся на уроках)
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_KEY)) router.replace('/welcome');
    } catch { /* ничего */ }
  }, [router]);
  const today = dateKey();
  const xp = todayXp(progress, today);
  const goal = progress.dailyGoalXp;
  const streak = currentStreak(progress, today);
  const due = dueWords(progress).length;
  const nextId = lessons.find((l) => isLessonFree(l.id) && !progress.lessons[l.id])?.id;

  return (
    <main className="page">
      <div className="brandbar">
        <div>
          <b>{APP_NAME}</b>
          <small>{APP_MOTTO}</small>
        </div>
        <Link href="/welcome" className="aboutlink">О тренажёре</Link>
      </div>
      <section className="card hero">
        <GoalRing value={xp} goal={goal} />
        <div>
          <h1>{xp >= goal ? 'Цель дня выполнена!' : `Ещё ${goal - xp} XP до цели`}</h1>
          <p className="muted">🔥 Серия: {streak} {plural(streak, 'день', 'дня', 'дней')} · всего {progress.xp} XP</p>
        </div>
      </section>

      {due > 0 && (
        <Link href="/review" className="card banner">
          🔁 Пора повторить слова: {due}
        </Link>
      )}

      <h2 className="section">Курс</h2>
      <p className="muted">Бесплатно открыты уроки 1–{FREE_LESSONS_COUNT}. Остальные скоро появятся в полной версии.</p>
      <div className="stack">
        {lessons.map((l, i) => {
          const done = progress.lessons[l.id];
          if (!isLessonFree(l.id)) {
            return (
              <div key={l.id} className="card lesson locked" aria-disabled="true">
                <span className="badge" aria-hidden>🔒</span>
                <span>
                  <b>{i + 1}. {l.title}</b>
                  <small>{l.subtitle}</small>
                  <small className="status">Скоро в полной версии</small>
                </span>
              </div>
            );
          }
          return (
            <Link key={l.id} href={`/lesson/${l.id}`} className={'card lesson' + (l.id === nextId ? ' next' : '')}>
              <span className="badge" aria-hidden>{l.emoji}</span>
              <span>
                <b>{i + 1}. {l.title}</b>
                <small>{l.subtitle}</small>
                <small className="status">
                  {done ? `Пройден · лучший результат ${Math.round(done.bestAccuracy * 100)}%` : l.id === nextId ? 'Следующий урок' : 'Не начат'}
                </small>
              </span>
            </Link>
          );
        })}
      </div>

      <p className="notice warn">⚠️ Автоматическое озвучивание иногда ошибается в произношении и ударениях. Это тренажёр для практики, а не полноценный учебник.</p>
    </main>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
