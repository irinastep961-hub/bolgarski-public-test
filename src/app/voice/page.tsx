'use client';

import { useState } from 'react';
import { VOICE_MISSING_MESSAGE, SPEECH_UNSUPPORTED_MESSAGE, speak } from '@/lib/speech';
import { selectVoice, useVoices } from '@/components/useVoices';
import SpeakerButton from '@/components/SpeakerButton';
import { PRONUNCIATION_CHECK, stressed } from '@/content/stress';
import { words } from '@/content';
import { SPEECH_HINT_WORDS } from '@/content/ttsHints';
import { getStressHints, setStressHints } from '@/lib/voicePrefs';

const SAMPLE = 'Добър ден! Казвам се Ана. Приятно ми е.';

export default function VoicePage() {
  const v = useVoices();
  const [hints, setHints] = useState(() => getStressHints());

  return (
    <main className="page">
      <h1>Озвучивание</h1>
      <p className="muted">Болгарский текст читает только настоящий болгарский голос вашего устройства. Русский голос приложение никогда не подставляет.</p>

      {v.status === 'checking' && <p className="notice">Проверяю голоса устройства…</p>}
      {v.status === 'unsupported' && <p className="notice">{SPEECH_UNSUPPORTED_MESSAGE}</p>}

      {v.status === 'ready' && (
        <section className="card block" aria-labelledby="vlist">
          <h2 id="vlist">Найдено болгарских голосов: {v.voices.length}</h2>
          {v.voices.length > 1 && <p className="muted">Выберите голос, который звучит лучше.</p>}
          <div className="stack" role="radiogroup" aria-label="Болгарский голос">
            {v.voices.map((x) => (
              <label key={x.voiceURI} className={'voice-row' + (x.voiceURI === v.selectedURI ? ' on' : '')}>
                <input
                  type="radio"
                  name="voice"
                  checked={x.voiceURI === v.selectedURI}
                  onChange={() => {
                    selectVoice(x.voiceURI);
                    void speak(SAMPLE);
                  }}
                />
                <span>
                  <b>{x.name}</b>
                  <small>{x.lang} · {x.localService ? 'на устройстве' : 'через интернет'}</small>
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => void speak(SAMPLE)}>🔊 Прослушать пример</button>
          <p className="muted">«{SAMPLE}»</p>
        </section>
      )}

      {v.status === 'missing' && (
        <section className="card block" role="alert">
          <h2>{VOICE_MISSING_MESSAGE}</h2>
          <p>Пока голос не установлен, кнопки 🔊 ничего не произносят — так лучше, чем слышать болгарский с русским произношением. Все упражнения работают и без звука.</p>
        </section>
      )}

      {v.status !== 'ready' && v.status !== 'checking' && (
        <>
          <h2 className="section">Как установить болгарский голос</h2>
          <section className="card block">
            <h2>Windows 10 и 11 (Chrome)</h2>
            <ol className="steps">
              <li>Откройте «Пуск» → «Параметры» → «Время и язык» → «Речь».</li>
              <li>В разделе «Управление голосами» нажмите «Добавить голоса», найдите «Болгарский (Болгария)» и установите. Это голос Microsoft Ivan.</li>
              <li>Полностью закройте Chrome (все окна) и откройте его снова.</li>
              <li>Откройте эту страницу: голос должен появиться в списке выше.</li>
            </ol>
            <p className="muted">Если Chrome голос не показывает, откройте приложение в Microsoft Edge: в нём обычно есть более качественные болгарские голоса (Borislav и Kalina; они работают через интернет).</p>
          </section>
          <section className="card block">
            <h2>Android</h2>
            <p>«Настройки» → «Язык и ввод» → «Синтез речи» → «Google» → «Установить голосовые данные» → «Болгарский».</p>
          </section>
          <section className="card block">
            <h2>iPhone, iPad, Mac</h2>
            <p>«Настройки» → «Универсальный доступ» → «Устный контент» → «Голоса» → «Болгарский» (голос Daria).</p>
            <p className="muted">Названия пунктов меню зависят от версии системы.</p>
          </section>
        </>
      )}

      {v.status === 'ready' && (
        <section className="card block" aria-labelledby="pcheck">
          <h2 id="pcheck">Проверка озвучки частотных слов</h2>
          <p className="muted">Прослушайте слово и сравните ударение с отмеченным. Ударение при озвучивании выбирает сам голос устройства; если он ошибается, это недостаток голоса.</p>
          <div className="stack">
            {PRONUNCIATION_CHECK.map((bg) => (
              <div key={bg} className="check-row">
                <SpeakerButton text={bg} label={`Прослушать слово: ${bg}`} />
                <span>
                  <b lang="bg">{stressed(bg) ?? bg}</b>
                  <small>{words.find((w) => w.bg === bg)?.ru ?? ''}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}


      {v.status === 'ready' && (
        <section className="card block" aria-labelledby="hcheck">
          <h2 id="hcheck">Проверка ударений</h2>
          <p className="muted">
            Обычно приложение передаёт голосу слово без изменений: знак ударения в тексте голоса Windows не понимают, и часть слов от него звучит хуже.
            Этот раздел нужен только для эксперимента: сравните «без подсказки» (так озвучивает приложение) и «с подсказкой» (в слово добавлен знак ударения).
            Приложение не может проверить звучание само, это можно сделать только на слух.
          </p>
          <label className="voice-row">
            <input type="checkbox" checked={hints} onChange={(e) => { setHints(e.target.checked); setStressHints(e.target.checked); }} />
            <span><b>Добавлять знак ударения в озвучку (эксперимент)</b><small>{hints ? 'включено: возможны искажения' : 'выключено: слова передаются голосу без изменений'}</small></span>
          </label>
          <div className="stack">
            {SPEECH_HINT_WORDS.map((bg) => (
              <div key={bg} className="check-row">
                <span>
                  <b lang="bg">{stressed(bg)}</b>
                  <small>{words.find((w) => w.bg === bg)?.ru ?? ''}</small>
                </span>
                <button type="button" className="btn" onClick={() => void speak(bg, { hints: false })}>🔊 без подсказки</button>
                <button type="button" className="btn" onClick={() => void speak(bg, { hints: true })}>🔊 с подсказкой</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="card block">
        <summary>Все голоса, которые видит браузер ({v.total})</summary>
        {v.total === 0 ? (
          <p className="muted">Браузер не сообщил ни об одном голосе.</p>
        ) : (
          <ul className="langs">
            {Object.entries(v.langs).sort().map(([lang, n]) => (
              <li key={lang}>{lang}: {n}</li>
            ))}
          </ul>
        )}
        <p className="muted">Если здесь нет языка «bg» или «bg-BG», браузер не видит болгарский голос.</p>
      </details>
    </main>
  );
}
