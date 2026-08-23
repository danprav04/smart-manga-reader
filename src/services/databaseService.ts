import * as SQLite from 'expo-sqlite';
import { BreakdownResult, StoredBreakdown, PageSummary } from '../types/breakdown';

const DB_NAME = 'smartmanga.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
  }
  return dbInstance;
};

export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
};

export const initDatabase = async (): Promise<void> => {
  const db = await getDb();
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      site_domain TEXT NOT NULL,
      full_translation TEXT,
      context_notes TEXT,
      screenshot_path TEXT,
      analyzed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS text_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      text_original TEXT NOT NULL,
      reading TEXT,
      furigana_text TEXT,
      translation TEXT,
      bbox_ymin INTEGER,
      bbox_xmin INTEGER,
      bbox_ymax INTEGER,
      bbox_xmax INTEGER,
      sort_order INTEGER,
      UNIQUE(page_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      reading TEXT NOT NULL,
      part_of_speech TEXT,
      meaning TEXT NOT NULL,
      context_sentence TEXT,
      region_index INTEGER,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS grammar_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      pattern TEXT NOT NULL,
      explanation TEXT NOT NULL,
      example_from_text TEXT,
      region_index INTEGER,
      sort_order INTEGER
    );
  `);
  
  // Migration for old databases that don't have furigana_text
  try {
    const columns = await db.getAllAsync<{name: string}>(`PRAGMA table_info(text_regions);`);
    if (columns && !columns.find(c => c.name === 'furigana_text')) {
      await db.execAsync(`ALTER TABLE text_regions ADD COLUMN furigana_text TEXT;`);
    }
  } catch (e) {
    console.warn('Failed to migrate text_regions table', e);
  }

  // Migration for old databases to drop UNIQUE constraint on pages.url
  try {
    const tableInfo = await db.getAllAsync<{sql: string}>(`SELECT sql FROM sqlite_master WHERE type='table' AND name='pages'`);
    if (tableInfo && tableInfo.length > 0 && tableInfo[0].sql.includes('UNIQUE')) {
      await db.execAsync(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS pages_new;
        CREATE TABLE pages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          site_domain TEXT NOT NULL,
          full_translation TEXT,
          context_notes TEXT,
          screenshot_path TEXT,
          analyzed_at TEXT NOT NULL
        );
        INSERT INTO pages_new SELECT id, url, site_domain, full_translation, context_notes, screenshot_path, analyzed_at FROM pages;
        DROP TABLE pages;
        ALTER TABLE pages_new RENAME TO pages;
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (e) {
    console.warn('Failed to migrate pages table to drop UNIQUE constraint', e);
  }
};

export const saveBreakdown = async (
  url: string, 
  domain: string, 
  result: BreakdownResult, 
  screenshotPath: string | undefined
): Promise<number> => {
  if (!url) throw new Error("Cannot save breakdown with empty URL");
  const db = await getDb();
  
  let pageId = -1;
  await db.withTransactionAsync(async () => {
    // Insert the page as a new scan
    const insertPage = await db.runAsync(
      `INSERT INTO pages (url, site_domain, full_translation, context_notes, screenshot_path, analyzed_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        url, 
        domain, 
        result.fullTranslation, 
        result.contextNotes || null, 
        screenshotPath || null, 
        new Date().toISOString()
      ]
    );
    
    pageId = insertPage.lastInsertRowId;

    // Insert text regions
    for (let i = 0; i < result.textRegions.length; i++) {
      const tr = result.textRegions[i];
      await db.runAsync(
        `INSERT INTO text_regions (page_id, text_original, reading, furigana_text, translation, bbox_ymin, bbox_xmin, bbox_ymax, bbox_xmax, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pageId, tr.text, tr.reading, tr.furiganaText || null, tr.translation,
          tr.boundingBox[0], tr.boundingBox[1], tr.boundingBox[2], tr.boundingBox[3], i
        ]
      );
    }

    // Insert vocabulary
    for (let i = 0; i < result.vocabulary.length; i++) {
      const v = result.vocabulary[i];
      await db.runAsync(
        `INSERT INTO vocabulary (page_id, word, reading, part_of_speech, meaning, context_sentence, region_index, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pageId, v.word, v.reading, v.partOfSpeech, v.meaning, v.contextSentence, v.regionIndex, i
        ]
      );
    }

    // Insert grammar points
    for (let i = 0; i < result.grammarPoints.length; i++) {
      const g = result.grammarPoints[i];
      await db.runAsync(
        `INSERT INTO grammar_points (page_id, pattern, explanation, example_from_text, region_index, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          pageId, g.pattern, g.explanation, g.exampleFromText, g.regionIndex, i
        ]
      );
    }
  });

  return pageId;
};

export const getBreakdownByUrl = async (url: string): Promise<StoredBreakdown | null> => {
  if (!url) return null;
  const db = await getDb();
  
  const page = await db.getFirstAsync<any>(`SELECT * FROM pages WHERE url = ? ORDER BY analyzed_at DESC LIMIT 1`, [url]);
  if (!page) return null;

  const textRegions = await db.getAllAsync<any>(`SELECT * FROM text_regions WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);
  const vocabulary = await db.getAllAsync<any>(`SELECT * FROM vocabulary WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);
  const grammarPoints = await db.getAllAsync<any>(`SELECT * FROM grammar_points WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);

  return {
    id: page.id,
    url: page.url,
    siteDomain: page.site_domain,
    analyzedAt: page.analyzed_at,
    screenshotPath: page.screenshot_path,
    fullTranslation: page.full_translation,
    contextNotes: page.context_notes,
    textRegions: textRegions.map(tr => ({
      text: tr.text_original,
      reading: tr.reading,
      furiganaText: tr.furigana_text,
      translation: tr.translation,
      boundingBox: [tr.bbox_ymin, tr.bbox_xmin, tr.bbox_ymax, tr.bbox_xmax]
    })),
    vocabulary: vocabulary.map(v => ({
      word: v.word,
      reading: v.reading,
      partOfSpeech: v.part_of_speech,
      meaning: v.meaning,
      contextSentence: v.context_sentence,
      regionIndex: v.region_index
    })),
    grammarPoints: grammarPoints.map(g => ({
      pattern: g.pattern,
      explanation: g.explanation,
      exampleFromText: g.example_from_text,
      regionIndex: g.region_index
    }))
  };
};

export const getBreakdownById = async (id: number): Promise<StoredBreakdown | null> => {
  const db = await getDb();
  
  const page = await db.getFirstAsync<any>(`SELECT * FROM pages WHERE id = ?`, [id]);
  if (!page) return null;

  const textRegions = await db.getAllAsync<any>(`SELECT * FROM text_regions WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);
  const vocabulary = await db.getAllAsync<any>(`SELECT * FROM vocabulary WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);
  const grammarPoints = await db.getAllAsync<any>(`SELECT * FROM grammar_points WHERE page_id = ? ORDER BY sort_order ASC`, [page.id]);

  return {
    id: page.id,
    url: page.url,
    siteDomain: page.site_domain,
    analyzedAt: page.analyzed_at,
    screenshotPath: page.screenshot_path,
    fullTranslation: page.full_translation,
    contextNotes: page.context_notes,
    textRegions: textRegions.map(tr => ({
      text: tr.text_original,
      reading: tr.reading,
      furiganaText: tr.furigana_text,
      translation: tr.translation,
      boundingBox: [tr.bbox_ymin, tr.bbox_xmin, tr.bbox_ymax, tr.bbox_xmax]
    })),
    vocabulary: vocabulary.map(v => ({
      word: v.word,
      reading: v.reading,
      partOfSpeech: v.part_of_speech,
      meaning: v.meaning,
      contextSentence: v.context_sentence,
      regionIndex: v.region_index
    })),
    grammarPoints: grammarPoints.map(g => ({
      pattern: g.pattern,
      explanation: g.explanation,
      exampleFromText: g.example_from_text,
      regionIndex: g.region_index
    }))
  };
};

export const getRecentBreakdowns = async (limit: number = 20): Promise<PageSummary[]> => {
  const db = await getDb();
  const pages = await db.getAllAsync<any>(
    `SELECT id, url, site_domain, analyzed_at, screenshot_path FROM pages ORDER BY analyzed_at DESC LIMIT ?`,
    [limit]
  );
  
  return pages.map(p => ({
    id: p.id,
    url: p.url,
    siteDomain: p.site_domain,
    analyzedAt: p.analyzed_at,
    screenshotPath: p.screenshot_path
  }));
};

export const hasBreakdownForUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;
  const db = await getDb();
  const result = await db.getFirstAsync<{count: number}>(`SELECT COUNT(*) as count FROM pages WHERE url = ?`, [url]);
  return (result?.count || 0) > 0;
};

export const deleteBreakdownForUrl = async (url: string): Promise<void> => {
  if (!url) return;
  const db = await getDb();
  await db.runAsync(`DELETE FROM pages WHERE url = ?`, [url]); // cascades due to PRAGMA foreign_keys
};

export const getVocabularyStatistics = async (): Promise<{word: string, reading: string, meaning: string, count: number}[]> => {
  const db = await getDb();
  return db.getAllAsync<{word: string, reading: string, meaning: string, count: number}>(`
    SELECT word, reading, meaning, COUNT(id) as count
    FROM vocabulary
    GROUP BY word, reading, meaning
    ORDER BY count DESC
  `);
};

export const getGrammarStatistics = async (): Promise<{pattern: string, explanation: string, count: number}[]> => {
  const db = await getDb();
  return db.getAllAsync<{pattern: string, explanation: string, count: number}>(`
    SELECT pattern, explanation, COUNT(id) as count
    FROM grammar_points
    GROUP BY pattern, explanation
    ORDER BY count DESC
  `);
};
