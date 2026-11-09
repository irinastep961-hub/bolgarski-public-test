'use client';

import Link from 'next/link';
import { useState } from 'react';
import { lessons as allLessons } from '@/content';
import { freeLessonIds } from '@/config/publicTest';
import { useProgress } from '@/components/ProgressProvider';
import SpeakerButton from '@/components/SpeakerButton';
import { stressed } from '@/content/stress';
import { useVoiceStatus } from '@/components/useVoiceStatus';
import { VOICE_MISSING_MESSAGE } from '@/lib/speech';
import { dueWords, toggleWord } from '@/lib/progress';

const lessons = allLessons.filter((l) => freeLessonIds.includes(l.id));

export default function WordsPage() {
  const { progress, update } = useProgress();
  const voice = useVoiceStatus();
  const [tab, setTab] = useState<'mine' | 'all'>(Object.keys(progress.words).length > 0 ? 'mine' : 'all');
  const due = new Set(dueWords(progress).map((w) => w.wordId));
  const mineCount = Object.keys(progress.words).length;

  return (
    <main className="page">
      <h1>Слова</h1>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Мой словарь · {mineCount}</button>
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Все слова</button>
      </div>
      {due.size > 0 && <Link href="/review" className="card banner">🔁 Повторить слова: {due.size}</Link>}
      {voice === 'missing' && (
        <p className="notice">{VOICE_MISSING_MESSAGE}. <Link href="/voice">Как установить голос</Link></p>
      )}

      {lessons.map((l) => {
        const list = l.words.filter((w) => tab === 'all' || progress.words[w.id]);
        if (list.length === 0) return null;
        return (
          <section key={l.id}>
            <h2 className="section">{l.emoji} {l.title}</h2>
            <div className="stack">
              {list.map((w) => {
                const saved = Boolean(progress.words[w.id]);
                return (
                  <div key={w.id} className="card word">
                    <SpeakerButton text={w.bg} />
                    <div className="grow">
                      <div className="bg">{w.bg}</div>
                      <div className="ru">{w.ru}</div>
                      {stressed(w.bg) && <div className="stress">Ударение: <b lang="bg">{stressed(w.bg)}</b></div>}
                      <div className="ex">{w.example.bg} — {w.example.ru}</div>
                      {w.note && <div className="note">💡 {w.note}</div>}
                      {due.has(w.id) && <div className="due">пора повторить</div>}
                    </div>
                    <button type="button" className={'star' + (saved ? ' on' : '')} aria-pressed={saved}
                      aria-label={saved ? 'Убрать из моего словаря' : 'Добавить в мой словарь'}
                      onClick={() => update((p) => toggleWord(p, w.id))}>
                      {saved ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {tab === 'mine' && mineCount === 0 && (
        <p className="muted">Здесь появятся слова из пройденных уроков. Можно добавить и вручную: откройте «Все слова» и нажмите ☆.</p>
      )}
    </main>
  );
}
