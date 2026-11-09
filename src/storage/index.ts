import { LocalStorageProgressRepository } from './LocalStorageProgressRepository';
import type { ProgressRepository } from './ProgressRepository';

export type { ProgressRepository };

// Единственное место, где выбирается хранилище.
// Для облака: заменить на new SyncedProgressRepository(local, supabaseRepo).
export const progressRepository: ProgressRepository = new LocalStorageProgressRepository();
