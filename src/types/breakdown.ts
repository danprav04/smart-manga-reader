export interface TextRegion {
  text: string;
  reading: string;
  furiganaText?: string;
  translation: string;
  boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

export interface VocabularyItem {
  word: string;
  reading: string;
  partOfSpeech: string;
  meaning: string;
  contextSentence: string;
  regionIndex: number;
}

export interface GrammarPoint {
  pattern: string;
  explanation: string;
  exampleFromText: string;
  regionIndex: number;
}

export interface ComprehensionQuestion {
  question: string;
  type: 'multiple_choice';
  options: string[];
  correctAnswer: string;  // 'A', 'B', 'C', or 'D'
  hint: string;
}

export interface BreakdownResult {
  textRegions: TextRegion[];
  vocabulary: VocabularyItem[];
  grammarPoints: GrammarPoint[];
  fullTranslation: string;
  contextNotes?: string;
  comprehensionQuestions?: ComprehensionQuestion[];
}

export interface StoredBreakdown extends BreakdownResult {
  id: number;
  url: string;
  siteDomain: string;
  analyzedAt: string;
  screenshotPath?: string;
  quizCompleted?: boolean;
}

export interface PageSummary {
  id: number;
  url: string;
  siteDomain: string;
  analyzedAt: string;
  screenshotPath?: string;
}

export interface DailyProgress {
  date: string;              // 'YYYY-MM-DD'
  pagesScanned: number;
  pagesCompleted: number;    // pages with questions answered correctly
  newWords: number;
  newGrammar: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeAvailable: boolean;
  freezeLastRecharged: string | null;
}

export interface GoalSettings {
  dailyPageGoal: number;
  streakFreezeEnabled: boolean;
  questionCheckModel: 'main' | 'fast';
}

export interface Settings {
  aiProvider: 'gemini' | 'openai';
  geminiModel: string;
  geminiFastModel: string;
  geminiFallbackSequence: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiFastModel: string;
  openaiFallbackSequence: string;
  readerBaseUrl: string;
  japaneseLevel: string;
  darkMode: boolean;
  nightReader: boolean;
  disableSpoilers: boolean;
  revealGroups: {
    readings: boolean;
    vocabulary: boolean;
    grammar: boolean;
  };
  goalSettings: GoalSettings;
}
