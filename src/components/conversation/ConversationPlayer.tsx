'use client';

import FeedbackBox, { SPEECH_FEEDBACK_TEXT } from '@/components/FeedbackBox';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Conversation, ConversationTurn, ConversationTurnResult } from '@/types';
import { applyConversation, conversationXp, turnXp } from '@/lib/progress';
import { LIMITS_NOTE, localReplyChecker, type ReplyChecker, type ReplyVerdict } from '@/lib/conversation';
import { useProgress } from '../ProgressProvider';
import SpeakerButton from '../SpeakerButton';
import VoiceInput from './VoiceInput';

interface LogEntry { turn: ConversationTurn; said: string; verdict: ReplyVerdict }
interface Summary { gained: number; results: ConversationTurnResult[] }

const BADGE: Record<string, string> = {
  correct: '✅ Верно',
  close: '🟡 Почти: смысл близок, но фраза отличается',
  off: '🔴 Не подходит к реплике собеседника',
};

function Run({ conversation, checker, onRestart }: { conversation: Conversation; checker: ReplyChecker; onRestart: () => void }) {
  const router = useRouter();
  const { progress, update } = useProgress();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'done'>('answering');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<ReplyVerdict | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const results = useRef(new Map<string, ConversationTurnResult>());
  const saved = useRef(false);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const turn = conversation.turns[index];
  const total = conversation.turns.length;

  useEffect(() => {
    if (phase === 'feedback') feedbackRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [phase, verdict]);

  const submit = async () => {
    if (busy || phase !== 'answering' || !text.trim()) return;
    setBusy(true);
    try {
      const v = await checker.check(turn, text, { register: conversation.register ?? 'formal', partner: conversation.partner });
      if (v.level === 'empty') return;
      const n = attempts + 1;
      setAttempts(n);
      let r = results.current.get(turn.id);
      if (!r) {
        r = { turnId: turn.id, attempts: 0, level: 'off', xp: 0 };
        results.current.set(turn.id, r);
      }
      r.attempts = n;
      // XP за реплику начисляется один раз: верный ответ уже засчитан — повторная отправка ничего не меняет
      if (r.level !== 'correct') {
        r.level = v.level;
        if (v.level === 'correct') r.xp = turnXp(n);
      }
      setVerdict(v);
      setPhase('feedback');
    } finally {
      setBusy(false);
    }
  };

  const finish = (entries: LogEntry[]) => {
    const arr = conversation.turns.map((t) => results.current.get(t.id) ?? { turnId: t.id, attempts: 0, level: 'off' as const, xp: 0 });
    const gained = conversationXp(progress, conversation.id, arr);
    if (!saved.current) {
      saved.current = true;
      update((p) => applyConversation(p, conversation.id, arr));
    }
    setLog(entries);
    setSummary({ gained, results: arr });
    setPhase('done');
  };

  const next = () => {
    if (!verdict) return;
    const entries = [...log, { turn, said: text, verdict }];
    if (index + 1 >= total) return finish(entries);
    setLog(entries);
    setIndex(index + 1);
    setText('');
    setVerdict(null);
    setAttempts(0);
    setShowHint(false);
    setPhase('answering');
  };

  const retry = () => {
    setPhase('answering');
    setVerdict(null);
  };

  if (phase === 'done' && summary) {
    const correct = summary.results.filter((r) => r.level === 'correct').length;
    const firstTry = summary.results.filter((r) => r.level === 'correct' && r.attempts === 1).length;
    const replay = summary.gained === 0 && summary.results.some((r) => r.xp > 0);
    return (
      <main className="page center">
        <div className="trophy" aria-hidden>🎤</div>
        <h1>Диалог пройден!</h1>
        <div className="stat-row">
          <div className="card stat"><b>+{summary.gained}</b>XP</div>
          <div className="card stat"><b>{correct}/{total}</b>реплик верно</div>
          <div className="card stat"><b>{firstTry}</b>с первой попытки</div>
        </div>
        {replay && <p className="muted">Повторная практика: XP за эти реплики уже был начислен раньше.</p>}
        <p className="muted">{LIMITS_NOTE}</p>
        <FeedbackBox kind="speech" heading={SPEECH_FEEDBACK_TEXT} context={`речевая практика «${conversation.title}»`} />
        <div className="stack">
          <Link href="/speaking" className="btn">К ситуациям</Link>
          <button type="button" className="btn light" onClick={onRestart}>Пройти ещё раз</button>
        </div>
      </main>
    );
  }

  const locked = phase !== 'answering';
  return (
    <div className="player">
      <header className="player-top">
        <button type="button" className="close" aria-label="Выйти" onClick={() => window.confirm('Выйти из диалога? Прогресс этой попытки не сохранится.') && router.push('/speaking')}>✕</button>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
          <div style={{ width: `${(index / total) * 100}%` }} />
        </div>
      </header>
      <div className="player-body conv">
        <h2 className="q">{conversation.emoji} {conversation.title}</h2>
        <p className="scene">{conversation.situation}</p>

        <div className="chat" aria-live="polite">
          {log.map((e, i) => (
            <div key={i} className="turn-done">
              <div className="bubble them">
                <div className="who">{conversation.partner}</div>
                <div className="bgline"><span>{e.turn.them.bg}</span></div>
                <div className="ruline">{e.turn.them.ru}</div>
              </div>
              <div className="bubble you">
                <div className="who">Вы {e.verdict.level === 'correct' ? '✅' : '✏️'}</div>
                <div className="bgline"><span>{e.said}</span></div>
              </div>
            </div>
          ))}
          <div className="bubble them">
            <div className="who">{conversation.partner}</div>
            <div className="bgline">
              <span lang="bg">{turn.them.bg}</span>
              <SpeakerButton text={turn.them.bg} label="Прослушать реплику собеседника" />
            </div>
            <div className="ruline">{turn.them.ru}</div>
          </div>
        </div>

        <div className="card task-card">
          <b>Ваша задача:</b> {turn.task}
          {turn.hint && !locked && (showHint ? (
            <p className="hint">Подсказка: {turn.hint}</p>
          ) : (
            <button type="button" className="linkbtn" onClick={() => setShowHint(true)}>Показать подсказку</button>
          ))}
        </div>

        {phase === 'answering' && (
          <>
            <div className="seg" role="tablist" aria-label="Способ ответа">
              <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>⌨️ Печатать</button>
              <button type="button" role="tab" aria-selected={mode === 'voice'} className={mode === 'voice' ? 'on' : ''} onClick={() => setMode('voice')}>🎤 Говорить</button>
            </div>
            {mode === 'text' ? (
              <div className="text-input">
                <textarea
                  className="input"
                  rows={3}
                  value={text}
                  placeholder="Ваш ответ на болгарском"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                <p className="tip">Печатайте русской раскладкой: все болгарские буквы в ней есть. Регистр и лишние пробелы не страшны.</p>
                <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => void submit()}>Проверить</button>
              </div>
            ) : (
              <VoiceInput value={text} onChange={setText} onSubmit={() => void submit()} disabled={busy} />
            )}
          </>
        )}

        {phase === 'feedback' && verdict && (
          <div ref={feedbackRef} className={'card feedback-card lv-' + verdict.level} role="status">
            <strong className="badge-line">{BADGE[verdict.level] ?? ''}</strong>
            <p className="said">Вы сказали: <span lang="bg">{text}</span></p>
            {verdict.level !== 'correct' && (
              <p>Исправленный вариант: <b lang="bg">{verdict.corrected}</b> <SpeakerButton text={verdict.corrected} label="Прослушать исправленный вариант" /></p>
            )}
            {verdict.message && <p className="fb-msg">{verdict.message}</p>}
            {!verdict.isNatural && (
              <p>Так говорят чаще всего: <b lang="bg">{verdict.natural}</b> <SpeakerButton text={verdict.natural} label="Прослушать естественный вариант" /></p>
            )}
            {turn.note && <p className="fb-note">💡 {turn.note}</p>}
            {verdict.level !== 'correct' && <p className="fb-note">{LIMITS_NOTE}</p>}
            <div className="row">
              {verdict.level !== 'correct' && <button type="button" className="btn light" onClick={retry}>Исправить ответ</button>}
              <button type="button" className="btn" onClick={next}>{index + 1 >= total ? 'Завершить диалог' : 'Продолжить диалог'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Разговорный тренажёр. Проверка ответов подключаемая (ReplyChecker): позже можно подставить AI-проверку. */
export default function ConversationPlayer({ conversation, checker = localReplyChecker }: { conversation: Conversation; checker?: ReplyChecker }) {
  const [run, setRun] = useState(0);
  return <Run key={run} conversation={conversation} checker={checker} onRestart={() => setRun(run + 1)} />;
}
