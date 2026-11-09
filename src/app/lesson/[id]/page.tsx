import Link from 'next/link';
import { notFound } from 'next/navigation';
import LessonFlow from '@/components/LessonFlow';
import { getLesson, lessons } from '@/content';
import { FREE_LESSONS_COUNT, isLessonFree } from '@/config/publicTest';

export function generateStaticParams() {
  return lessons.map((l) => ({ id: l.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  if (!isLessonFree(id)) {
    return (
      <main className="page center">
        <div className="card lockedpage">
          <div className="badge" aria-hidden>🔒</div>
          <h1>{lesson.title}</h1>
          <p>Этот урок пока закрыт: в пробной версии бесплатно доступны уроки 1–{FREE_LESSONS_COUNT}.</p>
        </div>
        <Link href="/" className="btn">К урокам</Link>
      </main>
    );
  }
  return <LessonFlow lesson={lesson} />;
}
