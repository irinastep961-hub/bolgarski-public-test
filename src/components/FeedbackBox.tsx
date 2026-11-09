import { BUILD_LABEL, feedbackLink } from '@/config/publicTest';

/** Отзыв и сообщение об ошибке — через страницу в Facebook. Адреса почты не собираются. */
export const PRACTICE_FEEDBACK_TEXT = 'Как вам задания? Нашли ошибку или хотите что-то предложить?';
export const SPEECH_FEEDBACK_TEXT = 'Удалось потренироваться говорить? Поделитесь впечатлениями!';

type Props = { context?: string; /** Свой заголовок: тогда блок короткий (практика / речь), стиль и ссылка те же */ heading?: string; kind?: 'intro' | 'practice' | 'speech' };

export default function FeedbackBox({ context, heading, kind = 'intro' }: Props) {
  const href = feedbackLink();
  if (heading) {
    return (
      <section className="card fbbox" aria-label="Отзыв или сообщение об ошибке" data-feedback={kind}>
        <h2>{heading}</h2>
        {context && <p>Укажите, где это: <b>{context}</b>.</p>}
        {href ? (
          <a className="btn" href={href} target="_blank" rel="noopener noreferrer">Оставить отзыв в Facebook</a>
        ) : (
          <button type="button" className="btn" disabled>Оставить отзыв в Facebook</button>
        )}
        <p className="muted small">Не пишите в отзыве пароли и личные данные.</p>
      </section>
    );
  }
  return (
    <section className="card fbbox" aria-label="Отзыв или сообщение об ошибке" data-feedback="intro">
      <h2>Отзыв или ошибка?</h2>
      <p>
        Нашли ошибку в тексте, ударении или упражнении? Или хотите что-то предложить? Напишите на нашей странице в Facebook.{' '}
        {context ? <>Укажите, где это: <b>{context}</b>.</> : 'Укажите номер урока и упражнение.'}
      </p>
      {href ? (
        <a className="btn" href={href} target="_blank" rel="noopener noreferrer">Оставить отзыв в Facebook</a>
      ) : (
        <button type="button" className="btn" disabled>Оставить отзыв в Facebook</button>
      )}
      <p className="muted small" data-testid="build-label">{BUILD_LABEL}</p>
      <p className="muted small">Не пишите в отзыве пароли и личные данные. Приложение само не собирает ни почту, ни имена.</p>
    </section>
  );
}
