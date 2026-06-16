import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Removed direct import of GoogleGenAI to avoid crash if module missing
import dotenv from 'dotenv';

dotenv.config();
// Dynamically import GoogleGenAI if available
let GoogleGenAIClass;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
  const mod = require('@google/genai');
  GoogleGenAIClass = mod.GoogleGenAI;
} catch (e) {
  console.warn('GoogleGenAI module not found, backend will operate without Gemini integration.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

// Initialize GenAI
async function generateContentWithRetry(params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const status = err?.status || err?.code;
      const isRateLimit = status === 429 || status === 'RESOURCE_EXHAUSTED' || String(err).includes('429') || String(err?.message).includes('429');
      const is503 = status === 503 || String(err).includes('503') || String(err?.message).includes('503');

      if ((isRateLimit || is503) && attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Gemini API error ${status || err?.message || err}, retry ${attempt}/${maxAttempts} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

let ai;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' && GoogleGenAIClass) {
  ai = new GoogleGenAIClass({ apiKey: process.env.GEMINI_API_KEY });
}

// Endpoint to classify the idea
app.post('/api/classify', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'API key is missing or not configured in .env' });
  }

  const { q1, q2, q3 } = req.body;

  const systemPrompt = `You are an AI use case classifier for enterprise accounts. Classify the user's workplace pain point into exactly one of three categories: Automation, Process Fix, or AI Use Case. Use these definitions:\n- Automation: The task follows fixed rules. Same input, same output. No judgment needed. Example: auto-generate a daily report.\n- Process Fix: The process itself is broken or duplicated. Technology won't fix it — the workflow needs to change first.\n- AI Use Case: The task requires reading messy/unstructured data or applying judgment. Example: reading 500 support tickets and grouping by issue type.`;

  const userPrompt = `Here are the answers:
Q1 (Don't want to do): ${q1}
Q2 (Taking too much time): ${q2}
Q3 (Recurring problem): ${q3}`;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-flash-lite-latest',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            idea_summary: { type: 'STRING' },
            category: { type: 'STRING', enum: ['Automation', 'Process Fix', 'AI Use Case'] },
            category_reason: { type: 'STRING' }
          },
          required: ['idea_summary', 'category', 'category_reason']
        }
      }
    });

    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (err) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: 'Something went wrong — please try again' });
  }
});

// Endpoint to classify individual items in batch
app.post('/api/classify-items', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'API key is missing or not configured in .env' });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  if (items.length === 0) {
    return res.json({ classifications: [] });
  }

  const systemPrompt = `You are an AI analyst. Categorize each workplace pain point into exactly one of three categories: "Automation", "AI Use Case", or "Process Fix". Use these definitions:
- Automation: The task follows fixed rules. Same input, same output. No judgment needed.
- AI Use Case: The task requires reading messy/unstructured data, extraction, summarization, or applying judgment.
- Process Fix: The process itself is broken, has approval bottlenecks, duplicate work, or ownership issues. Technology won't fix it — the workflow needs to change first.`;

  const userPrompt = `Here is the list of pain points:
${JSON.stringify(items, null, 2)}`;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-flash-lite-latest',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
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
                  category: { type: 'STRING', enum: ['Automation', 'AI Use Case', 'Process Fix'] },
                  reason: { type: 'STRING' }
                },
                required: ['item', 'category', 'reason']
              }
            }
          },
          required: ['classifications']
        }
      }
    });

    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (err) {
    console.error("Gemini API classify-items Error:", err);
    res.status(500).json({ error: 'Something went wrong — please try again' });
  }
});


// Endpoint to save submissions
app.post('/api/save', (req, res) => {
  const submission = req.body;
  submission.timestamp = new Date().toISOString();

  fs.readFile(SUBMISSIONS_FILE, 'utf8', (err, data) => {
    let submissions = [];
    if (!err && data) {
      try {
        submissions = JSON.parse(data);
      } catch (e) {
        console.error("Error parsing submissions.json");
      }
    }

    submissions.push(submission);

    fs.writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), (err) => {
      if (err) {
        console.error("Error writing submissions.json:", err);
        return res.status(500).json({ error: 'Failed to save submission' });
      }
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
});
