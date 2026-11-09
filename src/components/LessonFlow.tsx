'use client';

import { useState } from 'react';
import Link from 'next/link';
import FeedbackBox, { PRACTICE_FEEDBACK_TEXT } from '@/components/FeedbackBox';
import { isLessonFree } from '@/config/publicTest';
import { useRouter } from 'next/navigation';
import type { ExerciseResult, Lesson, SessionResult } from '@/types';
import { applySession, buildSession } from '@/lib/progress';
import { useProgress } from './ProgressProvider';
import ExercisePlayer from './ExercisePlayer';
import SessionSummary from './SessionSummary';
import SpeakerButton from './SpeakerButton';
import { stressed } from '@/content/stress';

type Stage = 'intro' | 'practice' | 'done';

export default function LessonFlow({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const { update } = useProgress();
  const [stage, setStage] = useState<Stage>('intro');
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<SessionResult | null>(null);

  const finish = (results: ExerciseResult[]) => {
    const s = buildSession('lesson', results, lesson.id);
    update((p) => applySession(p, s, lesson.words.map((w) => w.id)));
    setSession(s);
    setStage('done');
  };

  if (stage === 'practice') {
    return <ExercisePlayer key={attempt} exercises={lesson.exercises} onFinish={finish} onExit={() => router.push('/')} />;
  }
  if (stage === 'done' && session) {
    return (
      <SessionSummary
        session={session}
        title="Урок пройден!"
        feedback={isLessonFree(lesson.id) ? (
          <FeedbackBox kind="practice" heading={PRACTICE_FEEDBACK_TEXT} context={`урок «${lesson.title}», задания`} />
        ) : undefined}
        onRepeat={() => {
          setAttempt(attempt + 1);
          setStage('practice');
        }}
      />
    );
  }

  return (
    <main className="page">
      <button type="button" className="back" onClick={() => router.push('/')}>← Уроки</button>
      <h1>{lesson.emoji} {lesson.title}</h1>
      <p className="muted">{lesson.subtitle}</p>

      {lesson.intro.map((b) => (
        <section key={b.heading} className="card block">
          <h2>{b.heading}</h2>
          {b.text.map((t, i) => <p key={i}>{t}</p>)}
          {b.table && (
            <div className="gtable-wrap">
              <table className="gtable">
                <thead><tr>{b.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {b.table.rows.map((r) => (
                    <tr key={r[0]}>{r.map((c, i) => (i === 1 ? <td key={i} lang="bg"><b>{c}</b></td> : <td key={i} lang={i === 0 ? 'bg' : undefined}>{c}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <FeedbackBox context={`урок «${lesson.title}»`} />

      <h2 className="section">Слова урока</h2>
      <div className="stack">
        {lesson.words.map((w) => (
          <div key={w.id} className="card word">
            <SpeakerButton text={w.bg} />
            <div>
              <div className="bg">{w.bg}</div>
              <div className="ru">{w.ru}</div>
              {stressed(w.bg) && <div className="stress">Ударение: <b lang="bg">{stressed(w.bg)}</b></div>}
              <div className="ex">{w.example.bg} — {w.example.ru}</div>
              {w.note && <div className="note">💡 {w.note}</div>}
            </div>
          </div>
        ))}
      </div>
      {lesson.speakingId && (
        <>
          <h2 className="section">Говорим по-болгарски</h2>
          <Link href={`/speaking/${lesson.speakingId}`} className="card lesson" data-testid="speaking-link">
            <span className="badge" aria-hidden>🎤</span>
            <span>
              <b>Речевая практика к уроку</b>
              <small>Приятель задаёт вопросы по-болгарски — вы отвечаете вслух. Приложение покажет распознанный текст, перевод вопроса и естественный ответ.</small>
            </span>
          </Link>
        </>
      )}
      <div className="sticky-cta">
        <button type="button" className="btn" onClick={() => setStage('practice')}>Начать практику</button>
      </div>
    </main>
  );
}
