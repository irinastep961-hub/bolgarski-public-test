'use client';

import { useState } from 'react';
import type { DialogExercise } from '@/types';
import { checkText } from '@/lib/answer';
import SpeakerButton from '../SpeakerButton';
import type { ViewProps } from './shared';

export default function DialogView({ ex, locked, onSubmit }: ViewProps<DialogExercise>) {
  const [showRu, setShowRu] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [showHint, setShowHint] = useState(false);

  const header = (
    <>
      <h2 className="q">Диалог</h2>
      <p className="scene">{ex.scene}</p>
      <div className="chat">
        {ex.lines.map((l, i) => (
          <div key={i} className={'bubble ' + l.who}>
            <div className="bgline">
              <span>{l.bg}</span>
              <SpeakerButton text={l.bg} label="Прослушать реплику" />
            </div>
            {showRu && <div className="ruline">{l.ru}</div>}
          </div>
        ))}
      </div>
      <button type="button" className="linkbtn" onClick={() => setShowRu(!showRu)}>
        {showRu ? 'Скрыть перевод' : 'Показать перевод'}
      </button>
    </>
  );

  if (ex.mode === 'choice') {
    const best = ex.options.find((o) => o.ok) ?? ex.options[0];
    return (
      <>
        {header}
        <p className="task">{ex.task ?? 'Выберите подходящий ответ:'}</p>
        <div className="options">
          {ex.options.map((o, i) => {
            const state = locked ? (o.ok ? ' ok' : picked === i ? ' bad' : '') : picked === i ? ' picked' : '';
            return (
              <button key={i} type="button" className={'option' + state} disabled={locked} onClick={() => setPicked(i)}>
                {o.bg}
                {showRu && <small>{o.ru}</small>}
              </button>
            );
          })}
        </div>
        {!locked && (
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={picked === null}
              onClick={() => {
                if (picked === null) return;
                const o = ex.options[picked];
                onSubmit(o.ok, best.bg, o.ok ? undefined : o.why ?? 'Этот ответ не подходит к реплике собеседника.', ex.note);
              }}
            >
              Проверить
            </button>
          </div>
        )}
      </>
    );
  }

  const check = () => {
    const v = checkText(text, ex.accepted, { lang: 'bg', traps: ex.traps });
    onSubmit(v.correct, ex.accepted[0], v.message, ex.note);
  };
  return (
    <>
      {header}
      <p className="task">{ex.task}</p>
      <textarea
        className="input"
        rows={3}
        value={text}
        disabled={locked}
        placeholder="Ваш ответ на болгарском"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && text.trim() && !locked) {
            e.preventDefault();
            check();
          }
        }}
      />
      {ex.hint && !locked && (showHint ? (
        <p className="hint">Подсказка: {ex.hint}</p>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setShowHint(true)}>Показать подсказку</button>
      ))}
      {!locked && (
        <div className="actions">
          <button type="button" className="btn" disabled={!text.trim()} onClick={check}>Проверить</button>
        </div>
      )}
    </>
  );
}
