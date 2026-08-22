import EventSource from 'react-native-sse';
import { BreakdownResult, Settings } from '../types/breakdown';
import { getGeminiApiKey, getOpenAIApiKey } from '../store/settingsStore';
import { logger, LogCategory } from '../utils/logger';

const getSystemPrompt = (japaneseLevel: string) => `
You are an expert Japanese translator and language tutor.
Your task is to analyze a manga page and provide an exhaustive, detailed breakdown.
The user's current Japanese progression level is: ${japaneseLevel || 'Unknown'}. 
You have freedom in how you explain grammar and vocabulary, but you MUST be extremely thorough. Accommodate your explanations to the visual context of the scene and the user's level.

CRITICAL INSTRUCTIONS FOR EXHAUSTIVE EXTRACTION:
1. You MUST extract EVERY SINGLE text region visible in the manga image (speech bubbles, narration, sound effects, background text). Do NOT skip, summarize, or group distinct bubbles together.
2. For EVERY text region you identify, you MUST provide its original Japanese text, reading, translation, and bounding box. 
   - The bounding box MUST be a 4-element array [ymin, xmin, ymax, xmax] using normalized integer coordinates (0 to 1000). ymin is top, xmin is left, ymax is bottom, xmax is right. Box must tightly wrap the text.
3. You MUST provide at least one vocabulary item and one grammar point for EVERY sentence or text region inside its specific "vocabulary" and "grammarPoints" arrays in the detailedAnalysis section.
4. DO NOT be lazy. If there are 10 text bubbles, there MUST be 10 text regions extracted, and corresponding detailed analysis for all 10. Do not omit details to save space.

You must structure your JSON into TWO phases:
Phase 1: "textRegions" - Output all boxes and text quickly.
Phase 2: "detailedAnalysis" - Output vocabulary and grammar linked by ID.

Your output must be a JSON object with exactly this structure:
{
  "textRegions": [
    {
      "id": 1,
      "boundingBox": [ymin, xmin, ymax, xmax],
      "text": "...",
      "reading": "...",
      "furiganaText": "The original text but with readings ONLY for Kanji and Katakana formatted as {Base|Reading}. Do not add readings for Hiragana. Example: {俺|おれ}{今日|きょう}{初|はじ}めて{喋|しゃべ}ったわ",
      "translation": "..."
    }
  ],
  "detailedAnalysis": [
    {
      "id": 1,
      "vocabulary": [
        { "word": "...", "reading": "...", "partOfSpeech": "...", "meaning": "...", "contextSentence": "..." }
      ],
      "grammarPoints": [
        { "pattern": "...", "explanation": "...", "exampleFromText": "..." }
      ]
    }
  ],
  "fullTranslation": "...",
  "contextNotes": "..."
}
`;

const cleanJsonString = (str: string) => {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  
  // Extract just the JSON object to handle any trailing text outside the valid JSON
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned.trim();
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    // If it's a 429 Too Many Requests, wait and retry
    if (response.status === 429) {
      const waitTime = Math.min(8000, 1000 * Math.pow(2, attempt) + Math.random() * 1000);
      logger.warn(LogCategory.AI, `Rate limited (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await delay(waitTime);
      continue;
    }
    return response;
  }
  // If we exhaust retries or it's not a 429, just do a final fetch or return the last response
  return fetch(url, options);
};


const mapParsedBreakdown = (parsed: any): BreakdownResult => {
  const textRegions = parsed.textRegions || [];
  const detailedAnalysis = parsed.detailedAnalysis || [];
  
  const mappedTextRegions: any[] = [];
  const vocabulary: any[] = [];
  const grammarPoints: any[] = [];

  textRegions.forEach((region: any, index: number) => {
    mappedTextRegions.push({
      text: region.text || '',
      reading: region.reading || '',
      furiganaText: region.furiganaText || '',
      translation: region.translation || '',
      boundingBox: region.boundingBox || [0, 0, 0, 0]
    });

    const details = detailedAnalysis.find((d: any) => d.id === region.id) || region;

    if (Array.isArray(details.vocabulary)) {
      details.vocabulary.forEach((v: any) => {
        vocabulary.push({ ...v, regionIndex: index });
      });
    }

    if (Array.isArray(details.grammarPoints)) {
      details.grammarPoints.forEach((g: any) => {
        grammarPoints.push({ ...g, regionIndex: index });
      });
    }
  });

  const seenWords = new Set<string>();
  const dedupedVocab: any[] = [];
  vocabulary.forEach(v => {
    if (v.word && !seenWords.has(v.word)) {
      seenWords.add(v.word);
      dedupedVocab.push(v);
    }
  });

  return {
    textRegions: mappedTextRegions,
    vocabulary: dedupedVocab,
    grammarPoints: grammarPoints,
    fullTranslation: parsed.fullTranslation || '',
    contextNotes: parsed.contextNotes
  };
};

const extractArrayObjects = (str: string, keyName: string): any[] => {
  const arrayStart = str.indexOf(keyName);
  if (arrayStart === -1) return [];
  
  const bracketStart = str.indexOf('[', arrayStart);
  if (bracketStart === -1) return [];
  
  let depth = 0;
  let arrayDepth = 1;
  let inString = false;
  let escapeNext = false;
  let objectStart = -1;
  const objects: any[] = [];
  
  for (let i = bracketStart + 1; i < str.length; i++) {
    const char = str[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '[') {
        if (depth === 0) arrayDepth++;
      } else if (char === ']') {
        if (depth === 0) {
          arrayDepth--;
          if (arrayDepth === 0) break;
        }
      }
      
      if (char === '{') {
        if (depth === 0) objectStart = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && objectStart !== -1) {
          const objStr = str.substring(objectStart, i + 1);
          try {
            objects.push(JSON.parse(objStr));
          } catch (e) {
            // Partial or malformed
          }
          objectStart = -1;
        }
      }
    }
  }
  
  return objects;
};

const extractPartialBreakdown = (str: string): any => {
  const result: any = { textRegions: [], fullTranslation: "", contextNotes: "" };
  
  const textRegions = extractArrayObjects(str, '"textRegions"');
  const detailedAnalysis = extractArrayObjects(str, '"detailedAnalysis"');

  const allBoxes: any[] = [];
  // Extract all boxes that are currently streaming using regex
  const boxMatches = str.matchAll(/"id"\s*:\s*(\d+).*?"boundingBox"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/gs);
  for (const match of boxMatches) {
    allBoxes.push({
      id: parseInt(match[1]),
      boundingBox: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])],
      text: "",
      reading: "",
      furiganaText: "",
      translation: ""
    });
  }

  // Merge the fully parsed regions over the fast-extracted ones, preferring fully parsed properties
  const mergedRegions = allBoxes.map(box => {
    const completeRegion = textRegions.find((r: any) => r.id === box.id);
    const details = detailedAnalysis.find((d: any) => d.id === box.id) || { vocabulary: [], grammarPoints: [] };
    
    // Ensure we don't overwrite valid text with empty string if completeRegion doesn't have it
    const finalRegion = { ...box, ...details };
    if (completeRegion) {
      if (completeRegion.text) finalRegion.text = completeRegion.text;
      if (completeRegion.reading) finalRegion.reading = completeRegion.reading;
      if (completeRegion.furiganaText) finalRegion.furiganaText = completeRegion.furiganaText;
      if (completeRegion.translation) finalRegion.translation = completeRegion.translation;
      if (completeRegion.boundingBox) finalRegion.boundingBox = completeRegion.boundingBox;
    }
    return finalRegion;
  });

  // Ensure any complete regions not found by regex (edge cases) are still included
  textRegions.forEach((tr: any) => {
    if (!mergedRegions.find(mr => mr.id === tr.id)) {
      const details = detailedAnalysis.find((d: any) => d.id === tr.id) || { vocabulary: [], grammarPoints: [] };
      mergedRegions.push({ ...tr, ...details });
    }
  });

  result.textRegions = mergedRegions.sort((a, b) => a.id - b.id);
  return result;
};

const parseAndSalvageJson = (jsonString: string): BreakdownResult => {
  const cleaned = cleanJsonString(jsonString);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError: any) {
    try {
      const match = cleaned.match(/(.*"contextNotes"\s*:\s*"(?:[^"\\]|\\.)*")/s);
      if (match) {
        const salvaged = match[1] + '\n}';
        parsed = JSON.parse(salvaged);
      }
    } catch (e) {}
    if (!parsed) {
      throw new Error(`AI returned invalid format: ${jsonString}`);
    }
  }

  if (parsed.vocabulary && parsed.grammarPoints) {
    return parsed as BreakdownResult;
  }

  return mapParsedBreakdown(parsed);
};

export const analyzeScreenshot = async (
  base64Image: string,
  settings: Settings,
  signal?: AbortSignal,
  onProgress?: (partialResult: BreakdownResult) => void
): Promise<BreakdownResult> => {
  logger.info(LogCategory.AI, `Starting analysis. Provider: ${settings.aiProvider}, Base64 size: ${base64Image.length} chars`);
  try {
    const startTime = Date.now();
    let result: BreakdownResult;
    if (settings.aiProvider === 'gemini') {
      result = await analyzeWithGemini(base64Image, settings, signal, onProgress);
    } else {
      result = await analyzeWithOpenAI(base64Image, settings, signal, onProgress);
    }
    const elapsed = Date.now() - startTime;
    logger.info(LogCategory.AI, `Analysis completed successfully in ${elapsed}ms. Found ${result.textRegions?.length || 0} text regions.`);
    return result;
  } catch (e: any) {
    logger.warn(LogCategory.AI, `Analysis failed: ${e.message}`, e);
    throw e;
  }
};

const analyzeWithGemini = async (
  base64Image: string, 
  settings: Settings, 
  signal?: AbortSignal,
  onProgress?: (partialResult: BreakdownResult) => void
): Promise<BreakdownResult> => {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is not set');

  const defaultSequence = settings.geminiFallbackSequence 
    ? settings.geminiFallbackSequence.split(',').map(s => s.trim()).filter(Boolean)
    : ['gemini-3.1-flash', 'gemini-3.5-flash'];
  const modelsToTry = [settings.geminiModel || 'gemini-3.1-flash'];
  
  for (const model of defaultSequence) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    logger.info(LogCategory.AI, `Trying Gemini model: ${model} with Streaming`);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
      
      const payload = {
        system_instruction: { parts: [{ text: getSystemPrompt(settings.japaneseLevel) }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analyze this manga page.' },
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: {
            type: "OBJECT",
            properties: {
              textRegions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "INTEGER" },
                    boundingBox: { type: "ARRAY", items: { type: "INTEGER" } },
                    text: { type: "STRING" },
                    reading: { type: "STRING" },
                    furiganaText: { type: "STRING" },
                    translation: { type: "STRING" }
                  },
                  required: ["id", "boundingBox", "text", "reading", "furiganaText", "translation"]
                }
              },
              detailedAnalysis: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "INTEGER" },
                    vocabulary: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          word: { type: "STRING" },
                          reading: { type: "STRING" },
                          partOfSpeech: { type: "STRING" },
                          meaning: { type: "STRING" },
                          contextSentence: { type: "STRING" }
                        },
                        required: ["word", "reading", "partOfSpeech", "meaning", "contextSentence"]
                      }
                    },
                    grammarPoints: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          pattern: { type: "STRING" },
                          explanation: { type: "STRING" },
                          exampleFromText: { type: "STRING" }
                        },
                        required: ["pattern", "explanation", "exampleFromText"]
                      }
                    }
                  },
                  required: ["id", "vocabulary", "grammarPoints"]
                }
              },
              fullTranslation: { type: "STRING" },
              contextNotes: { type: "STRING" }
            },
            required: ["textRegions", "detailedAnalysis", "fullTranslation"]
          }
        }
      };

      let streamStartTime = Date.now();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const jsonString = await new Promise<string>((resolve, reject) => {
            let fullText = '';
            let isDone = false;
            let lastReportTime = 0;
            let firstChunkTime = 0;
            const requestStartTime = Date.now();
            
            const es = new EventSource(`${url}?alt=sse&key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (signal) {
              if (signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }
              signal.addEventListener('abort', () => {
                es.close();
                reject(new Error('Aborted'));
              });
            }

            es.addEventListener('message', (event: any) => {
              if (event.data) {
                try {
                  const now = Date.now();
                  if (firstChunkTime === 0) {
                    firstChunkTime = now;
                    logger.info(LogCategory.AI, `First chunk received after ${firstChunkTime - requestStartTime}ms`);
                  }
                  
                  const data = JSON.parse(event.data);
                  const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  fullText += chunk;
                  
                  if (onProgress && (now - lastReportTime > 500)) {
                    lastReportTime = now;
                    const partial = extractPartialBreakdown(fullText);
                    onProgress(mapParsedBreakdown(partial));
                  }
                } catch (e) {
                  // Ignore JSON parse errors for chunks
                }
              }
            });

            es.addEventListener('error', (err: any) => {
              es.removeAllEventListeners();
              es.close();
              if (!isDone) {
                const status = err.status || err.type;
                logger.warn(LogCategory.AI, `Stream error after ${Date.now() - requestStartTime}ms: ${status}`);
                reject(new Error(`Stream error: ${status}`));
              }
            });

            es.addEventListener('close', () => {
              isDone = true;
              es.removeAllEventListeners();
              es.close();
              logger.info(LogCategory.AI, `Stream completed in ${Date.now() - requestStartTime}ms`);
              resolve(fullText);
            });
          });

          logger.debug(LogCategory.AI, `Successfully received complete stream from ${model}, parsing JSON...`);
          return parseAndSalvageJson(jsonString);

        } catch (err: any) {
          const errMsg = err.message || '';
          if (errMsg.includes('429')) {
            const waitTime = Math.min(8000, 1000 * Math.pow(2, attempt) + Math.random() * 1000);
            logger.warn(LogCategory.AI, `Rate limited (429) on stream. Retrying in ${Math.round(waitTime)}ms...`);
            await delay(waitTime);
            continue;
          }
          throw err;
        }
      }
      throw new Error(`Exhausted retries for model ${model}`);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('Aborted') || error.message?.includes('aborted')) {
        throw error;
      }
      logger.warn(LogCategory.AI, `Failed with model ${model}, trying next...`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All fallback models failed');
};

const analyzeWithOpenAI = async (
  base64Image: string, 
  settings: Settings, 
  signal?: AbortSignal,
  onProgress?: (partialResult: BreakdownResult) => void
): Promise<BreakdownResult> => {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI API key is not set');

  const baseUrl = settings.openaiBaseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const defaultSequence = settings.openaiFallbackSequence 
    ? settings.openaiFallbackSequence.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const modelsToTry = [settings.openaiModel || 'gpt-4o'];
  
  // Add the default sequence as fallbacks, removing duplicates
  for (const model of defaultSequence) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  let lastError: Error | null = null;

  for (const modelToUse of modelsToTry) {
    logger.info(LogCategory.AI, `Using OpenAI API with model: ${modelToUse}`);
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: 'system', content: getSystemPrompt(settings.japaneseLevel) },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this manga page. Output JSON format.' },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errorMessage = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          } else if (parsed.detail) {
            errorMessage = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
            try {
              const detailParsed = JSON.parse(errorMessage);
              if (detailParsed.error && detailParsed.error.message) {
                errorMessage = detailParsed.error.message;
              }
            } catch (e) {
              // detail is not json, keep as is
            }
          }
        } catch (e) {
          // not json, keep original text
        }
        
        logger.warn(LogCategory.AI, `OpenAI API error with model ${modelToUse}: status ${response.status}`);
        throw new Error(`OpenAI API error with model ${modelToUse}: ${errorMessage}`);
      }

      const data = await response.json();
      const jsonString = data.choices?.[0]?.message?.content;
      if (!jsonString) {
        logger.warn(LogCategory.AI, `Invalid response format from OpenAI API model ${modelToUse}`);
        throw new Error(`Invalid response from OpenAI API model ${modelToUse}`);
      }

      logger.debug(LogCategory.AI, `Successfully received response from OpenAI model ${modelToUse}, parsing JSON...`);
      return parseAndSalvageJson(jsonString);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('Aborted') || error.message?.includes('aborted')) {
        throw error;
      }
      logger.warn(LogCategory.AI, `Failed with OpenAI model ${modelToUse}, trying next...`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All fallback OpenAI models failed');
};
