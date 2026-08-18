export interface TextRegion {
  text: string;
  reading: string;
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

export interface BreakdownResult {
  textRegions: TextRegion[];
  vocabulary: VocabularyItem[];
  grammarPoints: GrammarPoint[];
  fullTranslation: string;
  contextNotes?: string;
}

export interface StoredBreakdown extends BreakdownResult {
  id: number;
  url: string;
  siteDomain: string;
  analyzedAt: string;
  screenshotPath?: string;
}

export interface PageSummary {
  id: number;
  url: string;
  analyzedAt: string;
}

export interface Settings {
  aiProvider: 'gemini' | 'openai';
  geminiModel: string;
  geminiFallbackSequence: string;
  openaiBaseUrl: string;
  openaiModel: string;
  readerBaseUrl: string;
  japaneseLevel: string;
  darkMode: boolean;
  nightReader: boolean;
}
