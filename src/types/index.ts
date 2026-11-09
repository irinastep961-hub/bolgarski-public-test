// ---------- Слова ----------
export type ID = string;

export interface Word {
  id: ID;
  bg: string;
  ru: string;
  example: { bg: string; ru: string };
  /** Короткая подсказка для запоминания (ложные друзья и т. п.) */
  note?: string;
}

// ---------- Упражнения ----------
export interface ChoiceExercise {
  id: ID;
  type: 'choice';
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Если задано — доступна кнопка прослушивания (упражнение «на слух») */
  audio?: string;
  wordId?: ID;
  /** Объяснение для каждого варианта ответа (для верного — пустая строка) */
  why?: string[];
  note?: string;
}

/** Типичная ошибка и её объяснение по-русски (проверяется по словам ответа) */
export interface Trap {
  /** Ответ содержит это слово или фразу (целыми словами) */
  has?: string;
  /** Ответ начинается с этого слова или фразы */
  starts?: string;
  say: string;
}

/** Болгарское предложение -> перевод на русский (вводится текстом) */
export interface TranslateExercise {
  id: ID;
  type: 'translate';
  prompt: string;
  accepted: string[];
  traps?: Trap[];
  note?: string;
}

/** Русская фраза -> сборка болгарской из слов (порядок слов важен) */
export interface BuildExercise {
  id: ID;
  type: 'build';
  prompt: string;
  pool: string[];
  answer: string[];
  /** Другие верные варианты (например, иной порядок слов) */
  alternatives?: string[][];
  note?: string;
}

/** Русская фраза -> перевод на болгарский, вводится с клавиатуры */
export interface TypeExercise {
  id: ID;
  type: 'type';
  prompt: string;
  accepted: string[];
  traps?: Trap[];
  hint?: string;
  note?: string;
}

// ---------- Диалоги ----------
export interface DialogLine {
  who: 'them' | 'you';
  bg: string;
  ru: string;
}

export interface DialogOption {
  bg: string;
  ru: string;
  ok: boolean;
  /** Почему вариант не подходит (показывается при ошибке) */
  why?: string;
}

interface DialogBase {
  /** Ситуация по-русски */
  scene: string;
  lines: DialogLine[];
  note?: string;
}

/** Реплика собеседника -> выбрать подходящий ответ */
export interface DialogChoiceSource extends DialogBase {
  mode: 'choice';
  task?: string;
  options: DialogOption[];
}

/** Реплика собеседника -> напечатать подходящий ответ */
export interface DialogTypeSource extends DialogBase {
  mode: 'type';
  task: string;
  accepted: string[];
  traps?: Trap[];
  hint?: string;
}

export type DialogSource = DialogChoiceSource | DialogTypeSource;
export type DialogChoiceExercise = DialogChoiceSource & { id: ID; type: 'dialog' };
export type DialogTypeExercise = DialogTypeSource & { id: ID; type: 'dialog' };
export type DialogExercise = DialogChoiceExercise | DialogTypeExercise;

export type Exercise = ChoiceExercise | TranslateExercise | BuildExercise | TypeExercise | DialogExercise;

// ---------- Уроки ----------
export interface IntroBlock {
  heading: string;
  text: string[];
  /** Необязательная таблица (например, спряжение глагола) */
  table?: { head: string[]; rows: string[][] };
}

export interface SentenceSource {
  /** translate: bg -> ru (текстом); build: ru -> bg из слов; type: ru -> bg с клавиатуры */
  kind: 'translate' | 'build' | 'type';
  bg: string;
  ru: string;
  /** Допустимые варианты русского перевода */
  ruAlt?: string[];
  /** Другие верные болгарские варианты (для build и type) */
  bgAlt?: string[];
  /** Лишние слова для сборки фразы */
  distractors?: string[];
  traps?: Trap[];
  hint?: string;
  /** Короткое пояснение по-русски, показывается после ответа */
  note?: string;
}

/** Выбор пропущенной формы: «Аз ___ от Русия.» -> съм / си / са */
export interface FormChoiceSource {
  /** Предложение с пропуском ___ */
  prompt: string;
  /** Верная форма */
  answer: string;
  /** Неверные формы и объяснение по-русски, почему они не подходят */
  wrong: { form: string; why: string }[];
  note?: string;
}

/** Как урок описан в контенте (то, что пишет автор курса) */
export interface LessonSource {
  id: ID;
  title: string;
  subtitle: string;
  emoji: string;
  intro: IntroBlock[];
  wordIds: ID[];
  sentences: SentenceSource[];
  dialogs?: DialogSource[];
  /** Упражнения «выберите верную форму» (необязательно) */
  formChoices?: FormChoiceSource[];
  /** id разговорной ситуации (src/content/conversations.ts) — речевая практика к уроку */
  speakingId?: ID;
}

/** Готовый к показу урок */
export interface Lesson {
  id: ID;
  title: string;
  subtitle: string;
  emoji: string;
  intro: IntroBlock[];
  words: Word[];
  exercises: Exercise[];
  speakingId?: ID;
}

// ---------- Результаты ----------
export interface ExerciseResult {
  exerciseId: ID;
  wordId?: ID;
  /** Верно ли с первой попытки */
  correct: boolean;
  attempts: number;
}

export type SessionKind = 'lesson' | 'review';

export interface SessionResult {
  kind: SessionKind;
  lessonId?: ID;
  finishedAt: string;
  total: number;
  correct: number;
  xp: number;
  results: ExerciseResult[];
}

export type SessionSummary = Omit<SessionResult, 'results'>;

// ---------- Прогресс ----------
export interface WordState {
  wordId: ID;
  /** Коробка Лейтнера: 0..5 */
  box: number;
  dueAt: string;
  addedAt: string;
  seen: number;
  correct: number;
  wrong: number;
}

export interface LessonProgress {
  completions: number;
  bestAccuracy: number;
  lastCompletedAt: string;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

// ---------- Разговорная практика ----------
/** Грамматическая «рамка» ответа: по ней проверяются свободные ответы (src/lib/freeform.ts) */
export interface FreeSpec {
  /** Допустимые формы глагола «съм» (обычно одна) */
  forms: string[];
  /** Допустимые слова-сказуемые (оба рода и т. п.) — нужно хотя бы одно */
  predicates: string[];
  /** Начала слов: слово с такой основой, но не из списка — ошибка согласования */
  stems?: string[];
  /** Пояснение по-русски про согласование */
  agreeHint?: string;
  /** Другие безопасные слова, допустимые в ответе (наречия, места, имена) */
  extras?: string[];
  /** Допустимые «хвосты» ответа (нормализованные фразы), например «а ти» */
  tails?: string[];
  /** Можно ли ответить без глагола («Свободна.») */
  verbOptional?: boolean;
  /** Ответ «да/нет» должен согласоваться с отрицанием */
  yesNo?: boolean;
  /** После «от» допустимо любое название места */
  openPlace?: boolean;
  /** Допустим вопрос с «ли» (тогда «ли» стоит прямо перед глаголом) */
  question?: boolean;
  /** Все формы проверяемого глагола (по умолчанию — формы «съм»); верными считаются только `forms` */
  formSet?: string[];
  /** Глагол может стоять в начале фразы («Отивам на работа») */
  verbFirstOk?: boolean;
  /** В вопросе «ли» стоит после глагола («Идваш ли?»), а не перед ним */
  liAfter?: boolean;
  /** Слова, которые обязательно должны быть в ответе (например, «се» при «връщам се») */
  required?: string[];
  /** Слово → предлоги, с которыми оно употребляется: «работа» → ['на'] */
  pairs?: Record<string, string[]>;
}

export interface ConversationTurn {
  id: ID;
  /** Реплика собеседника */
  them: { bg: string; ru: string };
  /** Задание по-русски: что нужно сказать */
  task: string;
  /** Шаблоны допустимых ответов: {а|б|} — любой из вариантов (пустой допустим) */
  accepted: string[];
  /** Естественная фраза, которой пользуются болгары (тоже считается верной) */
  natural: string;
  /** Другие столь же естественные ответы (шаблоны): для них фраза «так говорят чаще» не показывается */
  alsoNatural?: string[];
  /** Начала слов, по которым ответ считается «по теме» */
  keys: string[];
  hint?: string;
  traps?: Trap[];
  /** Рамка для свободных ответов (необязательно): грамматически верные ответы вне шаблонов принимаются */
  free?: FreeSpec;
  /** Пояснение по-русски, показывается после ответа */
  note?: string;
}

export interface Conversation {
  id: ID;
  title: string;
  emoji: string;
  /** Кто собеседник */
  partner: string;
  /** Ситуация по-русски */
  situation: string;
  /** Обращение к собеседнику: formal — на «вы» (по умолчанию), informal — на «ты» */
  register?: 'formal' | 'informal';
  turns: ConversationTurn[];
}

export type ReplyLevel = 'correct' | 'close' | 'off';

export interface ConversationTurnResult {
  turnId: ID;
  attempts: number;
  level: ReplyLevel;
  /** XP, заработанные в этом прохождении (0, если верного ответа не было) */
  xp: number;
}

export interface ConversationProgress {
  completions: number;
  /** Сколько реплик было верно в лучшем прохождении */
  bestCorrect: number;
  lastCompletedAt: string;
  /** Реплики, за которые XP уже начислен (больше не начисляется) */
  rewardedTurns: ID[];
}

export interface Progress {
  version: 1;
  xp: number;
  dailyGoalXp: number;
  xpByDate: Record<string, number>;
  streak: Streak;
  lessons: Record<ID, LessonProgress>;
  words: Record<ID, WordState>;
  history: SessionSummary[];
  /** Разговорная практика (может отсутствовать в старых сохранениях — подставляется пустой) */
  conversations: Record<ID, ConversationProgress>;
}
