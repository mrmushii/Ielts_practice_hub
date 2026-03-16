# IELTS Platform — Frontend

A Next.js 16 (App Router) frontend for practicing all four IELTS modules — Speaking, Listening, Reading, and Writing — plus an omni-tutor assistant powered by an AI backend.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages](#pages)
  - [Landing Page](#landing-page)
  - [Speaking](#speaking-module)
  - [Listening](#listening-module)
  - [Reading](#reading-module)
  - [Writing](#writing-module)
  - [Tutor Workspace](#tutor-workspace)
- [Components](#components)
- [Utilities](#utilities)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)

---

## Overview

The frontend communicates exclusively with the FastAPI backend over HTTP. There is no direct database access or server-side AI logic in the frontend — all intelligence lives in the backend API.

Key UX patterns used across modules:
- Countdown timers matching official IELTS time limits
- Real-time audio recording and playback
- Instant AI feedback without page navigation
- Persistent floating tutor accessible on every page

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16 | App Router, React Server/Client components |
| React | 19 | UI rendering, hooks |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Lucide React | latest | Icon library |
| Sonner | latest | Toast notifications |

---

## Project Structure

```
frontend/
├── next.config.ts              # Next.js config (React compiler enabled)
├── postcss.config.mjs
├── tsconfig.json
├── package.json
│
└── src/
    ├── app/
    │   ├── globals.css          # Global Tailwind styles
    │   ├── layout.tsx           # Root layout (TutorBubbleButton injected here)
    │   ├── page.tsx             # Landing page
    │   ├── speaking/page.tsx    # Speaking test UI
    │   ├── listening/page.tsx   # Listening test UI
    │   ├── reading/page.tsx     # Reading test UI
    │   ├── writing/page.tsx     # Writing test UI
    │   └── tutor/page.tsx       # Full-screen tutor workspace
    │
    ├── components/
    │   ├── TutorBubbleButton.tsx # Floating chat widget (all pages)
    │   └── TutorRichText.tsx    # Markdown renderer for tutor responses
    │
    └── utils/
        ├── backend.ts           # Backend URL helper
        └── tutor-actions.ts     # TutorAction types and route builder
```

---

## Pages

### Landing Page

**Route:** `/`

The entry point of the application. Features:

- Hero section with tagline "Master IELTS with AI Precision"
- Module card grid linking to Speaking, Listening, Reading, and Writing
- Navbar with a live system status indicator (polls `/health`)
- Call-to-action buttons to start practising or view the GitHub repository
- Responsive layout: 1-column on mobile, 2-column on tablet, 4-column on desktop
- Glassmorphism card design with gradient accents

---

### Speaking Module

**Route:** `/speaking`

A full IELTS Speaking test simulation with voice interaction.

**Features:**
- Real-time microphone recording with automatic silence detection (stops after ~2 seconds of silence)
- Examiner audio playback after each AI response
- Live chat transcript showing examiner messages and candidate responses
- Voice/accent selector: British Female (default), British Male, American Female/Male, Australian Female/Male
- 14-minute countdown timer matching the IELTS Speaking test duration
- Part indicator badge (Part 1, 2, or 3) that updates automatically
- Text input fallback for environments without microphone access
- Microphone permission error handling with clear user messaging
- Full feedback panel on test completion (Band score + per-criterion breakdown)
- Auto-start support via `?tutor_start=1` query parameter (initiated from tutor actions)

**State flow:** `idle → testing → complete`

**API calls:**
- `POST /api/speaking/start` — initialise session
- `POST /api/speaking/respond` — send candidate answer, receive examiner reply
- `POST /api/speaking/feedback` — fetch final band score

---

### Listening Module

**Route:** `/listening`

Generates and plays a fresh IELTS-style listening passage on every visit.

**Features:**
- Multi-speaker audio player with play/pause and line-by-line navigation
- Synced transcript panel with speaker labels highlighted as audio plays
- 40-minute countdown timer
- Dynamic question carousel supporting MCQ and fill-in-the-blank formats
- Per-question answer tracking with immediate correctness feedback after submission
- Results summary screen showing score and correct answers
- Topic randomisation across 10+ predefined scenario types (bookings, travel, university, etc.)
- Auto-start support via `?tutor_start=1`

**Layout:** Top audio controls → Left transcript panel → Right question panel

**API calls:**
- `POST /api/listening/generate` — fetch dialogue + questions + audio URLs

---

### Reading Module

**Route:** `/reading`

A split-screen RAG-powered reading comprehension test.

**Features:**
- Auto-generates a new AI-written academic passage on page load
- Passage rendered on the left with paragraph formatting
- Questions displayed on the right with individual text inputs
- 20-minute countdown timer
- "Check Answer" button per question with loading state
- Feedback panel shows: correct/incorrect verdict, explanatory feedback, and the exact retrieved context used to grade the answer
- "New Test" button regenerates a completely fresh passage and question set
- AI-generated exam badge to distinguish dynamically created content

**Data flow:**
1. Page mount → `GET /api/reading/generate`
2. User types answer → `POST /api/reading/ask` (with passage text + question + user answer)
3. Display `{ is_correct, feedback, retrieved_context }`

---

### Writing Module

**Route:** `/writing`

A distraction-free essay editor with an integrated tutor sidebar and AI grading.

**Features:**
- Task selector: Task 1 (Graph/Chart, 20-minute timer) or Task 2 (Essay, 40-minute timer)
- AI-generated Task 1 chart image displayed alongside the prompt (with zoom toggle)
- Full-height prose editor with auto-save
- Real-time word count displayed below the editor
- Countdown timer with colour change warning when under 5 minutes
- "Submit Essay" button triggers full IELTS rubric grading
- Feedback panel displays all four scores (0–9), overall band, strengths, weaknesses, and an improved sample paragraph
- Integrated tutor chat sidebar — the tutor receives the live essay draft as context for inline suggestions
- Voice input button in the chat sidebar (transcribes via `/api/tutor/transcribe`)
- PDF upload button for document-grounded RAG queries

**API calls:**
- `GET /api/writing/prompts` — fetch Task 1 and Task 2 prompts
- `POST /api/writing/evaluate` — grade submitted essay
- `POST /api/tutor/chat` — tutor chat with `essay_context`

---

### Tutor Workspace

**Route:** `/tutor`

A full-screen dedicated chat interface for the AI tutor.

**Features:**
- Persistent conversation history with user and tutor message bubbles
- Markdown-rendered tutor responses (bold, bullet lists, numbered lists)
- Voice input via microphone (transcribed by Groq Whisper on the backend)
- PDF upload button — uploads documents to the backend vector store for RAG-grounded answers
- Module navigation actions: the tutor can suggest navigating to a specific module; user confirming triggers `next/navigation` to that route
- Toast notifications for confirmable navigation actions (via Sonner)
- Session ID persisted in `localStorage` (`tutor_session_id`) for multi-turn memory continuity across page reloads
- Auto-scroll to the latest message

**API calls:**
- `POST /api/tutor/chat`
- `POST /api/tutor/transcribe`
- `POST /api/documents/upload`

---

## Components

### `TutorBubbleButton`

A collapsible floating chat widget rendered on every page except `/tutor`. Sits in the bottom-right corner and shifts upward on the Writing page to avoid overlapping the editor controls.

- Contains the same full tutor functionality as the `/tutor` page
- Minimisable to a small button when not in use
- Includes a link to expand into the full Tutor Workspace
- Maintains its own separate session ID from the full tutor page

### `TutorRichText`

A lightweight inline Markdown renderer used to display tutor responses. Parses:

| Syntax | Rendered As |
|--------|-------------|
| `**bold**` | `<strong>` |
| `* item` / `- item` | Bullet list with accent dot |
| `1. item` | Numbered list with accent numbers |

Styled with Tailwind utility classes and accent colour tokens consistent with the rest of the UI.

---

## Utilities

### `src/utils/backend.ts`

Constructs backend API URLs from an environment variable:

```typescript
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000"

export function backendUrl(path: string): string
// Example: backendUrl("/api/speaking/start") → "http://localhost:8000/api/speaking/start"
```

### `src/utils/tutor-actions.ts`

Type definitions and helpers for tutor action objects returned by the backend:

```typescript
type TutorAction = {
  id: string
  type: "navigate_module" | "open_tutor_workspace" | "start_module_flow"
  module: string
  route: string
  label: string
  description: string
  start_action?: string
  requires_confirmation: boolean
}

type TutorResponseMeta = {
  intent: string
  confidence: number
  reason: string
  session_id?: string
}

type TutorChatResponse = {
  response: string
  actions?: TutorAction[]
  meta?: TutorResponseMeta
}

function buildTutorRoute(route: string, sessionId: string): string
// Appends ?session_id=<id> to module routes for session continuity
```

---

## Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
```

For production deployments, set this to your deployed backend URL (e.g. a Railway or Render service URL).

---

## Getting Started

### Prerequisites

- Node.js 20+
- The backend running at `http://localhost:8000` (or the URL set in `.env.local`)

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
