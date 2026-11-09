'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuildExercise, ChoiceExercise, Exercise, ExerciseResult, TranslateExercise } from '@/types';
import { checkBuild, checkText } from '@/lib/answer';
import { canSpeak, speak } from '@/lib/speech';
import SpeakerButton from './SpeakerButton';
import { useVoiceStatus } from './useVoiceStatus';
import DialogView from './exercises/DialogView';
import TypeView from './exercises/TypeView';
import type { Submit, ViewProps } from './exercises/shared';

function ChoiceView({ ex, locked, onSubmit }: ViewProps<ChoiceExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const voice = useVoiceStatus();
  const [reveal, setReveal] = useState(false);
  const showText = reveal || !canSpeak() || voice === 'missing';

  useEffect(() => {
    if (ex.audio) void speak(ex.audio, { quiet: true });
  }, [ex.audio]);

  return (
    <>
      <h2 className="q">{ex.prompt}</h2>
      {ex.audio && (
        <div className="listen">
          {!showText && <SpeakerButton text={ex.audio} big label="Прослушать слово" />}
          {showText ? (
            <div className="bgword">{ex.audio}</div>
          ) : (
            <button type="button" className="linkbtn" onClick={() => setReveal(true)}>Не слышно? Показать слово</button>
          )}
        </div>
      )}
      <div className="options">
        {ex.options.map((o, i) => {
          const state = locked ? (i === ex.correctIndex ? ' ok' : picked === i ? ' bad' : '') : picked === i ? ' picked' : '';
          return (
            <button key={i} type="button" className={'option' + state} disabled={locked} onClick={() => setPicked(i)}>
              {o}
            </button>
          );
        })}
      </div>
      {!locked && (
        <div className="actions">
          <button type="button" className="btn" disabled={picked === null} onClick={() => {
              if (picked === null) return;
              const ok = picked === ex.correctIndex;
              onSubmit(ok, ex.options[ex.correctIndex], ok ? undefined : ex.why?.[picked], ex.note);
            }}>
            Проверить
          </button>
        </div>
      )}
    </>
  );
}

function TranslateView({ ex, locked, onSubmit }: ViewProps<TranslateExercise>) {
  const [text, setText] = useState('');
  const check = () => {
    const v = checkText(text, ex.accepted, { lang: 'ru', traps: ex.traps });
    onSubmit(v.correct, ex.accepted[0], v.message, ex.note);
  };
  return (
    <>
      <h2 className="q">Переведите на русский</h2>
      <div className="sentence">
        <SpeakerButton text={ex.prompt} />
        <span>{ex.prompt}</span>
      </div>
      <textarea
        className="input"
        rows={3}
        value={text}
        disabled={locked}
        placeholder="Введите перевод"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && text.trim() && !locked) {
            e.preventDefault();
            check();
          }
        }}
      />
      {!locked && (
        <div className="actions">
          <button type="button" className="btn" disabled={!text.trim()} onClick={check}>
            Проверить
          </button>
        </div>
      )}
    </>
  );
}

function BuildView({ ex, locked, onSubmit }: ViewProps<BuildExercise>) {
  const [picked, setPicked] = useState<number[]>([]);
  const sentence = picked.map((i) => ex.pool[i]);
  return (
    <>
      <h2 className="q">Соберите фразу по-болгарски</h2>
      <p className="sentence">{ex.prompt}</p>
      <div className="answer-line">
        {sentence.map((w, k) => (
          <button key={k} type="button" className="chip" disabled={locked} onClick={() => setPicked(picked.filter((_, j) => j !== k))}>
            {w}
          </button>
        ))}
      </div>
      <div className="bank">
        {ex.pool.map((w, i) => (
          <button key={i} type="button" className={'chip' + (picked.includes(i) ? ' used' : '')} disabled={locked || picked.includes(i)} onClick={() => setPicked([...picked, i])}>
            {w}
          </button>
        ))}
      </div>
      {!locked && (
        <div className="actions">
          <button type="button" className="btn" disabled={picked.length === 0} onClick={() => {
            const v = checkBuild(sentence, [ex.answer, ...(ex.alternatives ?? [])]);
            onSubmit(v.correct, ex.answer.join(' '), v.message, ex.note);
          }}>
            Проверить
          </button>
        </div>
      )}
    </>
  );
}

interface Props {
  exercises: Exercise[];
  onFinish: (results: ExerciseResult[]) => void;
  onExit: () => void;
}

/** Проигрывает набор упражнений; ошибочные возвращаются в конец очереди. */
export default function ExercisePlayer({ exercises, onFinish, onExit }: Props) {
  const [queue, setQueue] = useState<Exercise[]>(exercises);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; message?: string; note?: string } | null>(null);
  const results = useRef(new Map<string, ExerciseResult>());
  const current = queue[index];

  const submit: Submit = (correct, answer, message, note) => {
    let r = results.current.get(current.id);
    if (!r) {
      r = { exerciseId: current.id, wordId: current.type === 'choice' ? current.wordId : undefined, correct, attempts: 0 };
      results.current.set(current.id, r);
    }
    r.attempts += 1;
    setFeedback({ correct, answer, message, note });
    if (correct) setCompleted((c) => c + 1);
  };

  const next = () => {
    if (!feedback) return;
    const q = feedback.correct ? queue : [...queue, current];
    setFeedback(null);
    if (index + 1 >= q.length) {
      onFinish([...results.current.values()]);
      return;
    }
    setQueue(q);
    setIndex(index + 1);
  };

  const locked = feedback !== null;
  const key = `${current.id}-${index}`;

  return (
    <div className="player">
      <header className="player-top">
        <button type="button" className="close" aria-label="Выйти" onClick={() => window.confirm('Выйти из урока? Прогресс этой попытки не сохранится.') && onExit()}>
          ✕
        </button>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={exercises.length} aria-valuenow={completed}>
          <div style={{ width: `${(completed / exercises.length) * 100}%` }} />
        </div>
      </header>
      <div className="player-body">
        {current.type === 'choice' && <ChoiceView key={key} ex={current} locked={locked} onSubmit={submit} />}
        {current.type === 'translate' && <TranslateView key={key} ex={current} locked={locked} onSubmit={submit} />}
        {current.type === 'build' && <BuildView key={key} ex={current} locked={locked} onSubmit={submit} />}
        {current.type === 'type' && <TypeView key={key} ex={current} locked={locked} onSubmit={submit} />}
        {current.type === 'dialog' && <DialogView key={key} ex={current} locked={locked} onSubmit={submit} />}
      </div>
      {feedback && (
        <div className={'feedback ' + (feedback.correct ? 'ok' : 'bad')} role="status">
          <div className="fb-text">
            <strong>{feedback.correct ? 'Верно!' : 'Неверно'}</strong>
            {feedback.message && <p className="fb-msg">{feedback.message}</p>}
            {!feedback.correct && <p className="fb-answer">Правильно: {feedback.answer}</p>}
            {feedback.note && <p className="fb-note">💡 {feedback.note}</p>}
          </div>
          <button type="button" className="btn light" onClick={next} autoFocus>
            Дальше
          </button>
        </div>
      )}
    </div>
  );
}
