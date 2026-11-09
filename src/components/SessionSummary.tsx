import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SessionResult } from '@/types';

export default function SessionSummary({ session, title, onRepeat, feedback }: { session: SessionResult; title: string; onRepeat?: () => void; feedback?: ReactNode }) {
  const accuracy = session.total ? Math.round((session.correct / session.total) * 100) : 0;
  return (
    <main className="page center">
      <div className="trophy" aria-hidden>🌹</div>
      <h1>{title}</h1>
      <div className="stat-row">
        <div className="card stat"><b>+{session.xp}</b>XP</div>
        <div className="card stat"><b>{accuracy}%</b>точность</div>
        <div className="card stat"><b>{session.total - session.correct}</b>ошибок</div>
      </div>
      <p className="muted">Ошибки возвращались в конец урока, пока вы не ответили верно.</p>
      {feedback}
      <div className="stack">
        <Link href="/" className="btn">К урокам</Link>
        {onRepeat && <button type="button" className="btn light" onClick={onRepeat}>Пройти ещё раз</button>}
      </div>
    </main>
  );
}
