import type { Progress } from '../types';
import { createEmptyProgress } from '../lib/progress';
import type { ProgressRepository } from './ProgressRepository';

const KEY = 'bolgarski:progress:v1';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class LocalStorageProgressRepository implements ProgressRepository {
  async load(): Promise<Progress> {
    try {
      const raw = store()?.getItem(KEY);
      if (!raw) return createEmptyProgress();
      const data = JSON.parse(raw) as Partial<Progress>;
      if (data.version !== 1) return createEmptyProgress(); // место для будущих миграций
      return { ...createEmptyProgress(), ...data };
    } catch {
      return createEmptyProgress();
    }
  }

  async save(progress: Progress): Promise<void> {
    try {
      store()?.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* переполнено или запрещено — приложение продолжает работать */
    }
  }

  async reset(): Promise<void> {
    store()?.removeItem(KEY);
  }
}
