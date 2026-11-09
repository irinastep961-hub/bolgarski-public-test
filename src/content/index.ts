import type { Lesson, Word } from '../types';
import { buildLesson, buildReviewExercises } from './build';
import { lessonSources } from './lessons';
import { words } from './words';

export const lessons: Lesson[] = lessonSources.map((s) => buildLesson(s, words));
export { words, buildReviewExercises };

export const getLesson = (id: string): Lesson | undefined => lessons.find((l) => l.id === id);
export const getWord = (id: string): Word | undefined => words.find((x) => x.id === id);
