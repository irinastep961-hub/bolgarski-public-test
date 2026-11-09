'use client';

import Link from 'next/link';
import { useProgress } from '@/components/ProgressProvider';
import { lessons as allLessons, words as allWords } from '@/content';
import { freeLessonIds } from '@/config/publicTest';
import { currentStreak, dateKey, lastDays, setDailyGoal } from '@/lib/progress';

const lessons = allLessons.filter((l) => freeLessonIds.includes(l.id));
const words = allWords.filter((w) => lessons.some((l) => l.words.some((x) => x.id === w.id)));
const GOALS = [20, 30, 50];
const DAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function StatsPage() {
  const { progress, update, reset } = useProgress();
  const today = dateKey();
  const days = lastDays(progress, 7, today);
  const max = Math.max(progress.dailyGoalXp, ...days.map((d) => d.xp));
  const done = lessons.filter((l) => progress.lessons[l.id]).length;
  const totals = progress.history.reduce((a, s) => ({ c: a.c + s.correct, t: a.t + s.total }), { c: 0, t: 0 });
  const accuracy = totals.t ? Math.round((totals.c / totals.t) * 100) : 0;

  return (
    <main className="page">
      <h1>Успехи</h1>
      <div className="grid2">
        <div className="card stat"><b>🔥 {currentStreak(progress, today)}</b>серия дней</div>
        <div className="card stat"><b>{progress.xp}</b>всего XP</div>
        <div className="card stat"><b>{done}/{lessons.length}</b>уроков</div>
        <div className="card stat"><b>{Object.keys(progress.words).length}/{words.length}</b>слов в словаре</div>
        <div className="card stat"><b>{accuracy}%</b>точность</div>
        <div className="card stat"><b>{progress.streak.longest}</b>лучшая серия</div>
      </div>

      <h2 className="section">Последние 7 дней</h2>
      <div className="card chart" role="img" aria-label="XP по дням за неделю">
        {days.map((d) => (
          <div key={d.date} className="col">
            <div className="barwrap"><div className={'fill' + (d.xp >= progress.dailyGoalXp ? ' goal' : '')} style={{ height: `${(d.xp / max) * 100}%` }} /></div>
            <small>{DAY[new Date(d.date + 'T12:00:00').getDay()]}</small>
            <small>{d.xp}</small>
          </div>
        ))}
      </div>

      <h2 className="section">Цель на день</h2>
      <div className="seg">
        {GOALS.map((g) => (
          <button key={g} type="button" className={progress.dailyGoalXp === g ? 'on' : ''} onClick={() => update((p) => setDailyGoal(p, g))}>{g} XP</button>
        ))}
      </div>
      <p className="muted">Один урок приносит примерно 25–40 XP.</p>

      <Link href="/voice" className="btn light linkbtn-block">🔊 Озвучивание и выбор голоса</Link>

      <button type="button" className="btn light danger" onClick={() => window.confirm('Удалить весь прогресс на этом устройстве?') && void reset()}>
        Сбросить прогресс
      </button>
    </main>
  );
}
