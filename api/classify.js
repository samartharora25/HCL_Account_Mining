import { GoogleGenAI } from '@google/genai';

// Retry wrapper for rate limits and transient errors
async function generateContentWithRetry(ai, params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const status = err?.status || err?.code;
      const isRateLimit =
        status === 429 ||
        status === 'RESOURCE_EXHAUSTED' ||
        String(err).includes('429') ||
        String(err?.message).includes('429');
      const is503 =
        status === 503 ||
        String(err).includes('503') ||
        String(err?.message).includes('503');

      if ((isRateLimit || is503) && attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(
          `Gemini API error ${status || err?.message}, retry ${attempt}/${maxAttempts} in ${Math.round(delay)}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res
      .status(500)
      .json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  const { q1, q2, q3 } = req.body;

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `You are an AI use case classifier for enterprise accounts. Classify the user's workplace pain point into exactly one of three categories: Automation, Process Fix, or AI Use Case. Use these definitions:\n- Automation: The task follows fixed rules. Same input, same output. No judgment needed. Example: auto-generate a daily report.\n- Process Fix: The process itself is broken or duplicated. Technology won't fix it — the workflow needs to change first.\n- AI Use Case: The task requires reading messy/unstructured data or applying judgment. Example: reading 500 support tickets and grouping by issue type.`;

  const userPrompt = `Here are the answers:\nQ1 (Don't want to do): ${q1}\nQ2 (Taking too much time): ${q2}\nQ3 (Recurring problem): ${q3}`;

  try {
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-2.0-flash-lite',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            idea_summary: { type: 'STRING' },
            category: {
              type: 'STRING',
              enum: ['Automation', 'Process Fix', 'AI Use Case'],
            },
            category_reason: { type: 'STRING' },
          },
          required: ['idea_summary', 'category', 'category_reason'],
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return res.json(parsed);
  } catch (err) {
    console.error('Gemini classify error:', err);
    return res
      .status(500)
      .json({ error: 'Something went wrong — please try again.' });
  }
}
