# HCL Account Mining 

## Overview

**HCL Account Mining** is a web application that helps enterprises identify and prioritize workplace pain points using AI-powered classification and scoring. Users answer three open‑ended questions about their daily work challenges. The app:

- **Classifies** each pain point into one of three categories – **Automation**, **Process Fix**, or **AI Use Case** – using Google Gemini's structured output.
- **Scores** and **ranks** items based on custom weightings (time spent, frequency, potential impact).
- Generates **bucket‑level summaries** and visual progress bars.
- Stores submissions for later analysis.

The UI is built with **React** (Vite) and the backend is an **Express** proxy that talks to the Gemini API.

## Features

- Dynamic categorization with Gemini Structured JSON output.
- Real‑time scoring with live tier colors.
- Manual category adjustment for edge cases.
- Persisted submissions (`submissions.json`).
- Responsive, polished UI with smooth animations, glass‑morphism style cards, and a modern color palette.
- Robust error handling and exponential back‑off for Gemini rate‑limit responses.

## Architecture

```
┌─────────────────────┐        ┌─────────────────────┐
│   React Frontend    │  HTTP  │   Express Backend    │
│   (Vite dev server)│ <──────►│   (proxy to Gemini) │
└─────────────────────┘        └─────────────────────┘
        │                              │
        ▼                              ▼
   UI components                API routes:
   - App.jsx                     • /api/classify
   - CSS (App.css)               • /api/classify-items
   - …                           • /api/save
```

## Screenshots

*(Add screenshots here – you can generate UI mock‑ups with `generate_image` if desired.)*

## Prerequisites

- **Node.js ≥ 20** (tested on v20.x)
- **npm** (comes with Node)
- A **Google Gemini API key** placed in a `.env` file:
  ```
  GEMINI_API_KEY=YOUR_GEMINI_API_KEY
  ```
  The project safely handles a missing key by disabling Gemini calls.

## Installation

```bash
# Clone repository (if you already have a local copy, skip this step)
# git clone https://github.com/pragyac09/AccountMining-.git
# Change into the project directory
cd HCL_account_mining

# Install dependencies
npm install
```

## Development

```bash
# Start both frontend (Vite) and backend (Express) concurrently
npm run dev
```

The frontend will be available at `http://localhost:<available_port>/` (Vite picks the first free port, e.g., 5175) and the backend API runs on `http://localhost:3001`.

### Common Issues

- **Port conflicts** – Vite automatically falls back to the next free port and logs the chosen URL.
- **PowerShell execution policy** – If `npm` scripts fail, run the command via `cmd /c npm.cmd run dev` (the `start.cmd` helper already does this).
- **Gemini module missing** – The server now performs a dynamic `require('@google/genai')`; if the package is not installed, the app continues to work without classification.

## Building for Production

```bash
npm run build   # Generates static assets in the `dist` folder
npm run preview # Serves the production build locally
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key used by the backend. | **Yes** for classification, otherwise the backend runs in fallback mode. |

The `.env` file is **ignored by Git** (see `.gitignore`).

## API Endpoints

- **POST** `/api/classify`
  - Body: `{ q1, q2, q3 }`
  - Returns: `{ idea_summary, category, category_reason }`
- **POST** `/api/classify-items`
  - Body: `{ items: ["pain point 1", "pain point 2", …] }`
  - Returns: `{ classifications: [{ item, category, reason }, …] }`
- **POST** `/api/save`
  - Body: `{ name, account, categorizedItems, bucketResults, answers }`
  - Persists the submission to `submissions.json`.

All responses are JSON; errors return `{ error: "…" }` with HTTP 500.

## Created by Interns at HCL Tech

1. Gauravi Shyam
2. Samarth Arora
3. Pragya Chakravarty


Please **do not commit the `.env` file**; it is listed in `.gitignore`.

## License

MIT © 2026 HCL Technologies.
