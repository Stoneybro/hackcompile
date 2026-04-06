# Hackathon Radar — Build Spec & Architecture

## Project Overview

A personal intelligence dashboard that automatically discovers hackathons and builder programs by mining GitHub repositories. Participants who submit to hackathons typically document their work in READMEs, creating a dense, searchable signal. This system harvests that signal, extracts the hackathon name and any available details using an LLM, stores it, and presents it in a clean dashboard with links to search for more information.

---

## Goals

- Automatically discover hackathons from GitHub repo READMEs on a schedule
- Extract the hackathon name and whatever other details are available using the AI SDK
- Store results in Neon Postgres
- Deduplicate events across multiple source repos
- Display events in a filterable dashboard
- For each event, provide a Google search link and any direct URL found in the README

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend + API routes | Next.js 14 (App Router) |
| Database | Neon (Postgres) |
| ORM | Drizzle ORM |
| Scheduling | Vercel Cron Jobs |
| LLM Extraction | Vercel AI SDK + Google Gemini (`@ai-sdk/google`) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

No Python. No Redis. No Celery. Everything runs in TypeScript within Next.js.

---

## Data Flow

```
Vercel Cron Job (every 6 hours)
        ↓
/api/collect (Next.js API route)
        ↓
GitHub Search API → list of repos mentioning "hackathon"
        ↓
For each repo → fetch README via GitHub API
        ↓
AI SDK (Gemini Flash) → extract whatever is available, minimum: hackathon name
        ↓
Deduplicate against existing Neon records by hackathon name
        ↓
Insert new events into Neon
        ↓
Next.js dashboard reads from Neon and displays events
Each event has a Google search link + direct URL if one was found
```

---

## Database Schema

Use Drizzle ORM. Define schema in `/lib/db/schema.ts`.

### Table: `events`

```typescript
import { pgTable, uuid, text, date, boolean, timestamp } from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathon_name: text('hackathon_name').notNull(),
  organizer: text('organizer'),
  ecosystem: text('ecosystem'),
  event_type: text('event_type'), // hackathon | grant | accelerator | builder_program | bounty | unknown
  deadline: date('deadline'),
  official_url: text('official_url'),       // only if explicitly found in the README
  google_search_url: text('google_search_url').notNull(), // always generated
  source_repo: text('source_repo'),         // github repo url that surfaced this event
  confidence: text('confidence'),           // high | medium | low
  first_seen: timestamp('first_seen').defaultNow(),
  last_seen: timestamp('last_seen').defaultNow(),
})
```

### Table: `raw_repos`

```typescript
export const rawRepos = pgTable('raw_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  repo_url: text('repo_url').unique().notNull(),
  repo_name: text('repo_name'),
  processed: boolean('processed').default(false),
  created_at: timestamp('created_at').defaultNow(),
})
```

`raw_repos` is a processing queue. Every repo found by GitHub search is logged here first. After extraction it is marked `processed = true`.

### Google Search URL Generation

When inserting a new event, always generate and store a Google search URL:

```typescript
const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(hackathon_name + ' hackathon')}`
```

This gives the user a one-click way to find the official page even when no direct URL was found in the README.

---

## API Routes

### `POST /api/collect`

Triggered by Vercel Cron every 6 hours.

**Steps:**
1. Query GitHub Search API for repos mentioning "hackathon" created in the last 7 days
2. For each repo, check if `repo_url` already exists in `raw_repos`
3. If new, insert into `raw_repos` with `processed = false`
4. Fetch README for each unprocessed repo
5. Send README to Gemini via AI SDK `generateObject()` with a relaxed Zod schema
6. If extraction returns a hackathon name, check `events` table for duplicates
7. If no duplicate, insert new event with generated `google_search_url`
8. Mark repo as `processed = true`

**GitHub Search Queries:**

Run all of these, combine results, deduplicate by repo URL before processing:

```
hackathon in:readme created:>DYNAMIC_DATE
"builder program" in:readme created:>DYNAMIC_DATE
"grant program" in:readme created:>DYNAMIC_DATE
"bounty program" in:readme created:>DYNAMIC_DATE
```

Replace `DYNAMIC_DATE` dynamically at runtime with a date 7 days before today.

Base URL:
```
https://api.github.com/search/repositories?q=QUERY&sort=created&order=desc&per_page=50
```

**Rate limiting:** Add a 2-second delay between README fetches. Use a GitHub personal access token via environment variable. Handle 403/429 errors with a 60-second retry.

---

### `GET /api/events`

Returns all events from Neon for the dashboard.

Query params:
- `ecosystem` — filter by ecosystem
- `type` — filter by event_type
- `upcoming` — if true, only return events where deadline >= today

---

## AI Extraction Layer

**File:** `/lib/extract.ts`

Use `generateObject()` from the Vercel AI SDK with a **relaxed Zod schema**. The goal is to extract whatever is present — at minimum the hackathon name. Do not expect or require complete data. Most READMEs will only say something like "Built for ETHGlobal Bangkok 2024" and that is enough.

```typescript
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

const hackathonSchema = z.object({
  hackathon_name: z.string().nullable(),       // the most important field
  organizer: z.string().nullable(),            // if mentioned
  ecosystem: z.string().nullable(),            // e.g. ethereum, solana, base — if obvious
  event_type: z.enum([
    'hackathon', 'grant', 'accelerator',
    'builder_program', 'bounty', 'unknown'
  ]).default('hackathon'),
  deadline: z.string().nullable(),             // YYYY-MM-DD if mentioned, otherwise null
  official_url: z.string().nullable(),         // only if a direct event URL exists in README
  confidence: z.enum(['high', 'medium', 'low'])
})

export async function extractHackathonInfo(readmeContent: string) {
  const truncated = readmeContent.slice(0, 3000)

  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: hackathonSchema,
    prompt: `
You are extracting hackathon information from a GitHub README.

Most READMEs will only mention the hackathon name and little else.
That is fine — the hackathon name is the most important field.

Extract whatever is present. Do not invent or guess fields that are not mentioned.
If you cannot find a hackathon name at all, return null for hackathon_name.

Confidence rules:
- high: hackathon name is clearly and explicitly stated
- medium: hackathon name is implied or partially mentioned
- low: only a vague reference exists

README:
${truncated}
    `
  })

  return object
}
```

If `hackathon_name` comes back null, skip the record — do not insert.

---

## Deduplication Logic

**File:** `/lib/deduplicate.ts`

Before inserting a new event, check for an existing record with a similar name using Postgres `similarity()` from the `pg_trgm` extension.

Enable it once in your Neon database:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Deduplication query using Drizzle raw SQL:
```typescript
import { sql } from 'drizzle-orm'

const existing = await db.execute(sql`
  SELECT id FROM events
  WHERE similarity(hackathon_name, ${newName}) > 0.6
  LIMIT 1
`)

if (existing.rows.length > 0) {
  // update last_seen instead of inserting
} else {
  // insert new event
}
```

---

## Vercel Cron Configuration

`vercel.json` at project root:

```json
{
  "crons": [
    {
      "path": "/api/collect",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Protect the route so only Vercel can trigger it:

```typescript
const authHeader = req.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## Environment Variables

```
GITHUB_TOKEN=                      # GitHub personal access token
GOOGLE_GENERATIVE_AI_API_KEY=      # Google AI Studio API key (free tier is sufficient)
DATABASE_URL=                      # Neon connection string (pooled)
CRON_SECRET=                       # Random string to protect cron route
```

---

## Frontend Dashboard

### Pages

**`/` — Main Dashboard**

Sections:
- **Upcoming** — events with a known deadline >= today, sorted by deadline ascending
- **Recently Discovered** — events added in the last 7 days, sorted by first_seen descending
- **All Events** — paginated full list

Filters:
- Ecosystem (dropdown)
- Type (dropdown)
- Confidence (toggle: show low confidence or not)

Each event row/card shows:
- Hackathon name
- Organizer (if available)
- Ecosystem badge (if available)
- Event type badge
- Deadline (if available — highlighted if within 7 days)
- Confidence dot (green = high, yellow = medium, red = low)
- **Search** button → opens `google_search_url` in a new tab
- **Official Site** button → only shown if `official_url` exists, opens in new tab
- Source repo link (small, secondary)

**`/events/[id]` — Event Detail Page**

Shows all stored fields for a single event plus prominent Search and Official Site buttons.

### Design Direction

Dark theme. Terminal / radar aesthetic. Monospace or semi-monospace font for metadata fields. Green or amber accents on a near-black background. Confidence shown as colored indicator dots. Newly discovered events have a subtle highlight or NEW badge. The overall feel is a signal intelligence tool, not a consumer product.

---

## File Structure

```
/app
  /page.tsx
  /events/[id]/page.tsx
  /api
    /collect/route.ts
    /events/route.ts
    /events/[id]/route.ts

/lib
  /github.ts          ← GitHub Search API + README fetching
  /extract.ts         ← AI SDK generateObject() extraction
  /deduplicate.ts     ← similarity-based dedup logic
  /db
    /index.ts         ← Neon + Drizzle client
    /schema.ts        ← table definitions

/components
  /EventCard.tsx
  /EventTable.tsx
  /FilterBar.tsx
  /ConfidenceBadge.tsx
  /EcosystemBadge.tsx

/types
  /index.ts

vercel.json
```

---

## Build Order (Recommended for Agent)

Follow this order strictly. Do not build everything at once.

1. Set up Neon database — create project, run `CREATE EXTENSION IF NOT EXISTS pg_trgm`
2. Set up Drizzle ORM — define schema, run migrations
3. Build `/lib/github.ts` — test GitHub search and README fetching, log output to console
4. Build `/lib/extract.ts` — test with 3-4 real READMEs, verify schema output
5. Build `/lib/deduplicate.ts`
6. Build `/api/collect` — wire all three together, test with a manual POST
7. Build `/api/events` — simple Drizzle query with optional filters
8. Build dashboard UI — plain unstyled table first, then apply design
9. Add `vercel.json` cron config
10. Deploy to Vercel, set environment variables, monitor first collection run

---

## Notes for the Agent

- Use TypeScript throughout, strict mode enabled
- Use Drizzle ORM with Neon serverless driver (`@neondatabase/serverless`)
- Use `@ai-sdk/google` with `generateObject()` and a Zod schema — do not use raw prompt-to-JSON parsing
- Gemini model: `gemini-2.0-flash`
- README content passed to Gemini must be truncated to 3000 characters
- If `hackathon_name` is null after extraction, skip the record entirely — do not insert
- Always generate and store `google_search_url` for every inserted event
- Only store `official_url` if a direct event link is explicitly present in the README — do not generate or guess it
- Log each collection run: repos found, repos processed, events inserted, events deduplicated, events skipped
- Handle GitHub rate limit errors (403/429) with a 60-second retry
- Handle Gemini API errors gracefully — if extraction fails, mark repo as processed anyway to avoid infinite reprocessing
- All dates stored as UTC