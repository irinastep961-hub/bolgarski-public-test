import type { Progress } from '../types';

/**
 * Единственная точка доступа к сохранённому прогрессу.
 * Интерфейс асинхронный намеренно: позже появятся реализации с сетью
 * (SupabaseProgressRepository, SyncedProgressRepository), а UI и учебная
 * логика останутся без изменений.
 */
export interface ProgressRepository {
  load(): Promise<Progress>;
  save(progress: Progress): Promise<void>;
  reset(): Promise<void>;
}
