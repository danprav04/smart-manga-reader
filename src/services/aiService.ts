import { BreakdownResult, Settings } from '../types/breakdown';
import { getGeminiApiKey, getOpenAIApiKey } from '../store/settingsStore';
import { logger, LogCategory } from '../utils/logger';

const getSystemPrompt = (japaneseLevel: string) => `
You are an expert Japanese translator and language tutor.
Your task is to analyze a manga page and provide a detailed breakdown.
The user's current Japanese progression level is: ${japaneseLevel || 'Unknown'}. 
You have freedom in how you explain grammar and vocabulary. Accommodate your explanations to the visual context of the scene and the user's level. Feel free to expand on cultural nuances, slang, or idioms if it helps a ${japaneseLevel || 'Unknown'} learner, or keep it brief if it's a concept they should already know.
Pay close attention to the visual context of the scene in the image (character expressions, actions, background, situation) to ensure the translations and explanations are highly accurate and contextually appropriate.

Please extract all text visible in the manga image (speech bubbles, narration, sound effects).
For each text region, provide:
1. The original Japanese text
2. The reading (with furigana/kana)
3. The English translation
4. The bounding box of the text. This MUST be a 4-element array [ymin, xmin, ymax, xmax] where each value is an integer between 0 and 1000 representing normalized coordinates (0,0 is top-left, 1000,1000 is bottom-right). ymin is top, xmin is left, ymax is bottom, xmax is right. Ensure the box tightly wraps the Japanese text itself, NOT the surrounding speech bubble.

Also provide a deduplicated list of vocabulary used across all text regions.
Link each vocabulary item to the index of the text region where it first appeared.
Provide grammar explanations for key grammatical patterns used.
Provide a full natural English translation of the entire page.

Your output must be a JSON object with this structure:
{
  "textRegions": [
    { "text": "...", "reading": "...", "translation": "...", "boundingBox": [ymin, xmin, ymax, xmax] }
  ],
  "vocabulary": [
    { "word": "...", "reading": "...", "partOfSpeech": "...", "meaning": "...", "contextSentence": "...", "regionIndex": 0 }
  ],
  "grammarPoints": [
    { "pattern": "...", "explanation": "...", "exampleFromText": "...", "regionIndex": 0 }
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


const parseAndSalvageJson = (jsonString: string): BreakdownResult => {
  const cleaned = cleanJsonString(jsonString);
  try {
    return JSON.parse(cleaned) as BreakdownResult;
  } catch (parseError: any) {
    // Try to salvage the JSON if the model appended extra invalid text after contextNotes
    try {
      const match = cleaned.match(/(.*"contextNotes"\s*:\s*"(?:[^"\\]|\\.)*")/s);
      if (match) {
        const salvaged = match[1] + '\n}';
        return JSON.parse(salvaged) as BreakdownResult;
      }
    } catch (e) {
      // If salvage fails, fall through to throwing the original error
    }
    throw new Error(`AI returned invalid format: ${jsonString}`);
  }
};

export const analyzeScreenshot = async (
  base64Image: string,
  settings: Settings
): Promise<BreakdownResult> => {
  logger.info(LogCategory.AI, `Starting analysis. Provider: ${settings.aiProvider}, Base64 size: ${base64Image.length} chars`);
  try {
    const startTime = Date.now();
    let result: BreakdownResult;
    if (settings.aiProvider === 'gemini') {
      result = await analyzeWithGemini(base64Image, settings);
    } else {
      result = await analyzeWithOpenAI(base64Image, settings);
    }
    const elapsed = Date.now() - startTime;
    logger.info(LogCategory.AI, `Analysis completed successfully in ${elapsed}ms. Found ${result.textRegions?.length || 0} text regions.`);
    return result;
  } catch (e: any) {
    logger.error(LogCategory.AI, `Analysis failed: ${e.message}`, e);
    throw e;
  }
};

const analyzeWithGemini = async (base64Image: string, settings: Settings): Promise<BreakdownResult> => {
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

        const response = await fetch(url, {
          method: 'POST',
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

const analyzeWithOpenAI = async (base64Image: string, settings: Settings): Promise<BreakdownResult> => {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI API key is not set');

  const baseUrl = settings.openaiBaseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const modelToUse = settings.openaiModel || 'gpt-4o';
  logger.info(LogCategory.AI, `Using OpenAI API with model: ${modelToUse}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelToUse,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getSystemPrompt(settings.japaneseLevel) },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this manga page.' },
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
    const err = await response.text();
    logger.warn(LogCategory.AI, `OpenAI API error: status ${response.status}`);
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  const jsonString = data.choices?.[0]?.message?.content;
  if (!jsonString) {
    logger.warn(LogCategory.AI, `Invalid response format from OpenAI API`);
    throw new Error('Invalid response from OpenAI API');
  }

  logger.debug(LogCategory.AI, `Successfully received response from OpenAI, parsing JSON...`);
  return parseAndSalvageJson(jsonString);
};
