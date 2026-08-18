import * as SQLite from 'expo-sqlite';
import { BreakdownResult, StoredBreakdown, PageSummary } from '../types/breakdown';

const DB_NAME = 'smartmanga.db';

export const initDatabase = async (): Promise<void> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
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
};

export const saveBreakdown = async (
  url: string, 
  domain: string, 
  result: BreakdownResult, 
  screenshotPath: string | undefined
): Promise<number> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Start a transaction implicitly by using runAsync sequentially or with a helper
  // Wait, in expo-sqlite we can use withTransactionAsync
  let pageId = -1;
  await db.withTransactionAsync(async () => {
    // Upsert the page
    const insertPage = await db.runAsync(
      `INSERT INTO pages (url, site_domain, full_translation, context_notes, screenshot_path, analyzed_at) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         full_translation=excluded.full_translation,
         context_notes=excluded.context_notes,
         screenshot_path=excluded.screenshot_path,
         analyzed_at=excluded.analyzed_at
       RETURNING id`,
      [
        url, 
        domain, 
        result.fullTranslation, 
        result.contextNotes || null, 
        screenshotPath || null, 
        new Date().toISOString()
      ]
    );
    
    // In SQLite < 3.35 RETURNING might not be available, but we can get it via lastInsertRowId if new, or select it
    // Wait, let's just select it to be safe.
    const pageRow = await db.getFirstAsync<{id: number}>(`SELECT id FROM pages WHERE url = ?`, [url]);
    if (!pageRow) throw new Error("Failed to save page");
    pageId = pageRow.id;

    // Clear old data for this page
    await db.runAsync(`DELETE FROM text_regions WHERE page_id = ?`, [pageId]);
    await db.runAsync(`DELETE FROM vocabulary WHERE page_id = ?`, [pageId]);
    await db.runAsync(`DELETE FROM grammar_points WHERE page_id = ?`, [pageId]);

    // Insert text regions
    for (let i = 0; i < result.textRegions.length; i++) {
      const tr = result.textRegions[i];
      await db.runAsync(
        `INSERT INTO text_regions (page_id, text_original, reading, translation, bbox_ymin, bbox_xmin, bbox_ymax, bbox_xmax, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pageId, tr.text, tr.reading, tr.translation,
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
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  const page = await db.getFirstAsync<any>(`SELECT * FROM pages WHERE url = ?`, [url]);
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

export const hasBreakdownForUrl = async (url: string): Promise<boolean> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const result = await db.getFirstAsync<{count: number}>(`SELECT COUNT(*) as count FROM pages WHERE url = ?`, [url]);
  return (result?.count || 0) > 0;
};

export const deleteBreakdownForUrl = async (url: string): Promise<void> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync(`DELETE FROM pages WHERE url = ?`, [url]); // cascades due to PRAGMA foreign_keys
};
