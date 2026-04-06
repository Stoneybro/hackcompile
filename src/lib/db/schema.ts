import { pgTable, uuid, text, date, boolean, timestamp } from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathon_name: text('hackathon_name').notNull(),
  organizer: text('organizer'),
  ecosystem: text('ecosystem'),
  event_type: text('event_type'),        // hackathon | grant | accelerator | builder_program | bounty | unknown
  description: text('description'),      // short one-liner if found in README
  prize_pool: text('prize_pool'),        // e.g. "$50,000" — if found in README
  deadline: date('deadline'),
  status: text('status').default('active'), // active | expired | unknown
  official_url: text('official_url'),       // only if explicitly found in README
  google_search_url: text('google_search_url').notNull(), // always generated
  source_repo: text('source_repo'),         // github repo url that surfaced this event
  confidence: text('confidence'),           // high | medium | low
  first_seen: timestamp('first_seen').defaultNow(),
  last_seen: timestamp('last_seen').defaultNow(),
})

export const rawRepos = pgTable('raw_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  repo_url: text('repo_url').unique().notNull(),
  repo_name: text('repo_name'),
  processed: boolean('processed').default(false),
  created_at: timestamp('created_at').defaultNow(),
})
