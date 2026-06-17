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

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res
      .status(500)
      .json({ error: 'GEMINI_API_KEY or VITE_GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  if (items.length === 0) {
    return res.json({ classifications: [] });
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `You are an AI analyst. Categorize each workplace pain point into exactly one of three categories: "Automation", "AI Use Case", or "Process Fix". Use these definitions:
- Automation: The task follows fixed rules. Same input, same output. No judgment needed.
- AI Use Case: The task requires reading messy/unstructured data, extraction, summarization, or applying judgment.
- Process Fix: The process itself is broken, has approval bottlenecks, duplicate work, or ownership issues. Technology won't fix it — the workflow needs to change first.`;

  const userPrompt = `Here is the list of pain points:\n${JSON.stringify(items, null, 2)}`;

  try {
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-flash-lite-latest',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            classifications: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  item: { type: 'STRING' },
                  category: {
                    type: 'STRING',
                    enum: ['Automation', 'AI Use Case', 'Process Fix'],
                  },
                  reason: { type: 'STRING' },
                },
                required: ['item', 'category', 'reason'],
              },
            },
          },
          required: ['classifications'],
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return res.json(parsed);
  } catch (err) {
    console.error('Gemini classify-items error:', err);
    return res
      .status(500)
      .json({ error: 'Classification failed — please try again.' });
  }
}
