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
3. You MUST provide at least one vocabulary item and one grammar point for EVERY sentence or text region inside its specific "vocabulary" and "grammarPoints" arrays, unless it is a simple sound effect or a single character without grammatical context.
4. DO NOT be lazy. If there are 10 text bubbles, there MUST be 10 text regions extracted, and corresponding vocabulary and grammar for all 10. Do not omit details to save space.

Provide a full natural English translation of the entire page at the end.

Your output must be a JSON object with exactly this structure:
{
  "textRegions": [
    {
      "text": "...",
      "reading": "...",
      "furiganaText": "The original text but with readings ONLY for Kanji and Katakana formatted as {Base|Reading}. Do not add readings for Hiragana. Example: {俺|おれ}{今日|きょう}{初|はじ}めて{喋|しゃべ}ったわ",
      "translation": "...",
      "boundingBox": [ymin, xmin, ymax, xmax],
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


const parseAndSalvageJson = (jsonString: string): BreakdownResult => {
  const cleaned = cleanJsonString(jsonString);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError: any) {
    // Try to salvage the JSON if the model appended extra invalid text after contextNotes
    try {
      const match = cleaned.match(/(.*"contextNotes"\s*:\s*"(?:[^"\\]|\\.)*")/s);
      if (match) {
        const salvaged = match[1] + '\n}';
        parsed = JSON.parse(salvaged);
      }
    } catch (e) {
      // If salvage fails, fall through to throwing the original error
    }
    if (!parsed) {
      throw new Error(`AI returned invalid format: ${jsonString}`);
    }
  }

  // Support legacy format if model ignores instructions
  if (parsed.vocabulary && parsed.grammarPoints) {
    return parsed as BreakdownResult;
  }

  // Map from nested format
  const textRegions = parsed.textRegions || [];
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

    if (Array.isArray(region.vocabulary)) {
      region.vocabulary.forEach((v: any) => {
        vocabulary.push({ ...v, regionIndex: index });
      });
    }

    if (Array.isArray(region.grammarPoints)) {
      region.grammarPoints.forEach((g: any) => {
        grammarPoints.push({ ...g, regionIndex: index });
      });
    }
  });

  // Deduplicate vocabulary by word
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

export const analyzeScreenshot = async (
  base64Image: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<BreakdownResult> => {
  logger.info(LogCategory.AI, `Starting analysis. Provider: ${settings.aiProvider}, Base64 size: ${base64Image.length} chars`);
  try {
    const startTime = Date.now();
    let result: BreakdownResult;
    if (settings.aiProvider === 'gemini') {
      result = await analyzeWithGemini(base64Image, settings, signal);
    } else {
      result = await analyzeWithOpenAI(base64Image, settings, signal);
    }
    const elapsed = Date.now() - startTime;
    logger.info(LogCategory.AI, `Analysis completed successfully in ${elapsed}ms. Found ${result.textRegions?.length || 0} text regions.`);
    return result;
  } catch (e: any) {
    logger.error(LogCategory.AI, `Analysis failed: ${e.message}`, e);
    throw e;
  }
};

const analyzeWithGemini = async (base64Image: string, settings: Settings, signal?: AbortSignal): Promise<BreakdownResult> => {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is not set');

  const defaultSequence = settings.geminiFallbackSequence 
    ? settings.geminiFallbackSequence.split(',').map(s => s.trim()).filter(Boolean)
    : ['gemini-3.1-flash', 'gemini-3.5-flash'];
  const modelsToTry = [settings.geminiModel || 'gemini-3.1-flash'];
  
  // Add the default sequence as fallbacks, removing duplicates
  for (const model of defaultSequence) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  let lastError: Error | null = null;

    for (const model of modelsToTry) {
      logger.info(LogCategory.AI, `Trying Gemini model: ${model}`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetchWithRetry(url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: getSystemPrompt(settings.japaneseLevel) }]
            },
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
                        text: { type: "STRING" },
                        reading: { type: "STRING" },
                        furiganaText: { type: "STRING" },
                        translation: { type: "STRING" },
                        boundingBox: {
                          type: "ARRAY",
                          items: { type: "INTEGER" }
                        },
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
                      required: ["text", "reading", "furiganaText", "translation", "boundingBox", "vocabulary", "grammarPoints"]
                    }
                  },
                  fullTranslation: { type: "STRING" },
                  contextNotes: { type: "STRING" }
                },
                required: ["textRegions", "fullTranslation"]
              }
            }
          })
        });

        if (!response.ok) {
          const err = await response.text();
          logger.warn(LogCategory.AI, `Gemini API error with model ${model}: status ${response.status}`);
          throw new Error(`Gemini API error with model ${model}: ${err}`);
        }

        const data = await response.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonString) {
          logger.warn(LogCategory.AI, `Invalid response format from Gemini model ${model}`);
          throw new Error(`Invalid response from Gemini model ${model}`);
        }

        logger.debug(LogCategory.AI, `Successfully received response from ${model}, parsing JSON...`);
        return parseAndSalvageJson(jsonString);
      } catch (error) {
        logger.warn(LogCategory.AI, `Failed with model ${model}, trying next...`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

  throw lastError || new Error('All fallback models failed');
};

const analyzeWithOpenAI = async (base64Image: string, settings: Settings, signal?: AbortSignal): Promise<BreakdownResult> => {
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
    } catch (error) {
      logger.warn(LogCategory.AI, `Failed with OpenAI model ${modelToUse}, trying next...`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All fallback OpenAI models failed');
};
