'use client';

import Link from 'next/link';
import { conversations } from '@/content/conversations';
import { useProgress } from '@/components/ProgressProvider';
import { isConversationFree } from '@/config/publicTest';

export default function SpeakingPage() {
  const { progress } = useProgress();
  return (
    <main className="page">
      <h1>Разговорная практика</h1>
      <p className="muted">Выберите ситуацию и отвечайте собеседнику письменно или голосом. После каждого ответа приложение покажет исправленный вариант, объяснит ошибки по-русски и подскажет, как обычно говорят болгары.</p>

      <p className="notice">
        Как это работает: ответ сверяется с заранее подготовленными вариантами. Приложение не использует ИИ, не понимает любые фразы и не оценивает произношение. Реплики собеседника озвучиваются только болгарским голосом устройства (настройка: «Успехи» → «Озвучивание»).
      </p>

      <h2 className="section">Ситуации</h2>
      <div className="stack">
        {conversations.map((c) => {
          const done = progress.conversations?.[c.id];
          if (!isConversationFree(c.id)) {
            return (
              <div key={c.id} className="card lesson locked" aria-disabled="true">
                <span className="badge" aria-hidden>🔒</span>
                <span>
                  <b>{c.title}</b>
                  <small className="status">Скоро в полной версии</small>
                </span>
              </div>
            );
          }
          return (
            <Link key={c.id} href={`/speaking/${c.id}`} className="card lesson">
              <span className="badge" aria-hidden>{c.emoji}</span>
              <span>
                <b>{c.title}</b>
                <small>{c.situation}</small>
                <small className="status">
                  {done ? `Пройдено ${done.completions} раз · лучший результат: ${done.bestCorrect} из ${c.turns.length} реплик` : `${c.turns.length} реплик · не начато`}
                </small>
              </span>
            </Link>
          );
        })}
      </div>

      <details className="card block">
        <summary>Советы по произношению</summary>
        <p><b>ъ</b> — самостоятельный гласный [ɤ], которого нет в русском: не «а» и не «ы». Например, «къща» (дом).</p>
        <p><b>щ</b> — это сочетание «шт»: «още» произносится примерно «ошто».</p>
        <p><b>е</b> — звук [ɛ], и согласный перед ним остаётся твёрдым: «те» не звучит как русское «тье».</p>
        <p><b>Ударение</b> в болгарском не отмечается на письме и может падать на разные слоги: запоминайте его вместе со словом и слушайте носителя.</p>
        <p className="muted">Приложение не оценивает ваше произношение: распознанный браузером текст показывает лишь, насколько речь была понятна распознавателю.</p>
      </details>
    </main>
  );
}
