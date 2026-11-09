/** Общие типы экранов упражнений */
export type Submit = (correct: boolean, answer: string, message?: string, note?: string) => void;

export interface ViewProps<T> {
  ex: T;
  locked: boolean;
  onSubmit: Submit;
}
