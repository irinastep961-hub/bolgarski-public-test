'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buildReviewExercises, words } from '@/content';
import ExercisePlayer from '@/components/ExercisePlayer';
import { useProgress } from '@/components/ProgressProvider';
import SessionSummary from '@/components/SessionSummary';
import { applySession, buildSession, dateKey, dueWords } from '@/lib/progress';
import type { Exercise, ExerciseResult, SessionResult } from '@/types';

const SESSION_SIZE = 10;

export default function ReviewPage() {
  const { progress, update } = useProgress();
  const [exercises] = useState<Exercise[]>(() =>
    buildReviewExercises(dueWords(progress).slice(0, SESSION_SIZE).map((w) => w.wordId), words, dateKey()),
  );
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState<SessionResult | null>(null);

  const finish = (results: ExerciseResult[]) => {
    const s = buildSession('review', results);
    update((p) => applySession(p, s));
    setSession(s);
  };

  if (session) return <SessionSummary session={session} title="Повторение завершено!" />;
  if (started) return <ExercisePlayer exercises={exercises} onFinish={finish} onExit={() => setStarted(false)} />;

  return (
    <main className="page">
      <h1>Повторение</h1>
      {exercises.length === 0 ? (
        <>
          <p className="muted">Сейчас повторять нечего. Слова появятся здесь, когда вы пройдёте урок или добавите слова в «Мой словарь».</p>
          <Link href="/" className="btn">К урокам</Link>
        </>
      ) : (
        <>
          <p className="muted">Слов к повторению: {exercises.length}. Верные ответы переносят слово в следующую «коробку» — оно вернётся через день, три, неделю и дальше.</p>
          <button type="button" className="btn" onClick={() => setStarted(true)}>Начать</button>
        </>
      )}
    </main>
  );
}
