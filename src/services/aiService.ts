import { BreakdownResult, Settings } from '../types/breakdown';
import { getGeminiApiKey, getOpenAIApiKey } from '../store/settingsStore';

const getSystemPrompt = (japaneseLevel: string) => `
You are an expert Japanese translator and language tutor.
Your task is to analyze a manga page and provide a detailed breakdown.
The user's current Japanese progression level is: ${japaneseLevel || 'Unknown'}. 
Tailor your grammar and vocabulary explanations to be appropriate for this level.

Please extract all text visible in the manga image (speech bubbles, narration, sound effects).
For each text region, provide:
1. The original Japanese text
2. The reading (with furigana/kana)
3. The English translation
4. The bounding box of the text. This MUST be a 4-element array [ymin, xmin, ymax, xmax] where each value is an integer between 0 and 1000 representing normalized coordinates. (0,0 is top-left, 1000,1000 is bottom-right).

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

export const analyzeScreenshot = async (
  base64Image: string,
  settings: Settings
): Promise<BreakdownResult> => {
  if (settings.aiProvider === 'gemini') {
    return analyzeWithGemini(base64Image, settings);
  } else {
    return analyzeWithOpenAI(base64Image, settings);
  }
};

const analyzeWithGemini = async (base64Image: string, settings: Settings): Promise<BreakdownResult> => {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is not set');

  const defaultSequence = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  const modelsToTry = [settings.geminiModel || 'gemini-3.7-flash'];
  
  // Add the default sequence as fallbacks, removing duplicates
  for (const model of defaultSequence) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
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
        throw new Error(`Gemini API error with model ${model}: ${err}`);
      }

      const data = await response.json();
      const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonString) throw new Error(`Invalid response from Gemini model ${model}`);

      return JSON.parse(jsonString) as BreakdownResult;
    } catch (error) {
      console.warn(`Failed with model ${model}, trying next...`, error);
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel || 'gpt-4o',
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
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  const jsonString = data.choices?.[0]?.message?.content;
  if (!jsonString) throw new Error('Invalid response from OpenAI API');

  return JSON.parse(jsonString) as BreakdownResult;
};
