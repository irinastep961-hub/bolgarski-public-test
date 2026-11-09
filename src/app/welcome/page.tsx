'use client';

import { useRouter } from 'next/navigation';
import FeedbackBox from '@/components/FeedbackBox';
import { APP_MOTTO, APP_NAME, FREE_LESSONS_COUNT, WELCOME_KEY } from '@/config/publicTest';
import { RECOGNITION_PRIVACY_NOTE } from '@/lib/recognition';

export default function WelcomePage() {
  const router = useRouter();
  const start = () => {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* без хранилища просто идём дальше */ }
    router.push('/');
  };
  return (
    <main className="page welcome">
      <header className="card welcome-hero">
        <div className="welcome-flag" aria-hidden>🇧🇬</div>
        <h1>{APP_NAME}</h1>
        <p className="motto">{APP_MOTTO}</p>
        <p className="muted">Пробная версия: короткие уроки, слова и разговорная практика для тех, кто начинает болгарский.</p>
      </header>

      <button type="button" className="btn" onClick={start}>Начать</button>

      <h2 className="section">Что это такое</h2>
      <div className="card block">
        <p><b>Это тренажёр для практики, а не полноценный учебник.</b> Здесь вы повторяете слова и фразы, учитесь выбирать нужную форму, собирать предложения и отвечать собеседнику. Подробных объяснений грамматики, как в учебнике, здесь нет: только короткие подсказки.</p>
        <p>Лучше всего тренажёр работает вместе с учебником, преподавателем или общением с носителями.</p>
      </div>

      <h2 className="section">Что доступно бесплатно</h2>
      <div className="card block">
        <p>Первые <b>{FREE_LESSONS_COUNT} уроков</b> и связанная с ними разговорная практика открыты для всех.</p>
        <p>Регистрация, пароль и оплата <b>не нужны</b>. Приложение не собирает адреса почты и имена.</p>
        <p>Ваш прогресс хранится только в браузере на этом устройстве. Если очистить данные браузера, он пропадёт.</p>
      </div>

      <h2 className="section">Важно знать об озвучивании</h2>
      <p className="notice warn">
        ⚠️ Автоматическое озвучивание иногда ошибается в произношении и ударениях: его создаёт голос вашего устройства, а не диктор. Если слово звучит странно, проверьте ударение в карточке слова или у носителя. Нашли ошибку — сообщите нам, мы исправим.
      </p>
      <p className="muted small">{RECOGNITION_PRIVACY_NOTE}</p>

      <FeedbackBox />
      <button type="button" className="btn light" onClick={start}>К урокам</button>
    </main>
  );
}
