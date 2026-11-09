'use client';

import { useState } from 'react';
import type { TypeExercise } from '@/types';
import { checkText } from '@/lib/answer';
import type { ViewProps } from './shared';

export default function TypeView({ ex, locked, onSubmit }: ViewProps<TypeExercise>) {
  const [text, setText] = useState('');
  const [showHint, setShowHint] = useState(false);

  const check = () => {
    const v = checkText(text, ex.accepted, { lang: 'bg', traps: ex.traps });
    onSubmit(v.correct, ex.accepted[0], v.message, ex.note);
  };

  return (
    <>
      <h2 className="q">Напишите по-болгарски</h2>
      <p className="sentence">{ex.prompt}</p>
      <textarea
        className="input"
        rows={3}
        value={text}
        disabled={locked}
        placeholder="Ваш перевод на болгарском"
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
      <p className="tip">Печатайте русской раскладкой: все болгарские буквы в ней есть. Букв «ы», «э», «ё» в болгарском нет.</p>
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
