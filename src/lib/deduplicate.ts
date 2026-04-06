import { db } from './db'
import { events } from './db/schema'
import { sql } from 'drizzle-orm'

/**
 * Check whether an event with a similar hackathon name already exists.
 * Uses pg_trgm similarity() — requires the extension to be enabled in Neon:
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *
 * Returns the existing event id if found, otherwise null.
 */
export async function findSimilarEvent(hackathonName: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM events
    WHERE similarity(hackathon_name, ${hackathonName}) > 0.6
    LIMIT 1
  `)

  if (result.rows.length > 0) {
    return result.rows[0].id as string
  }
  return null
}

/**
 * Update last_seen timestamp for an existing event that matched on name similarity.
 */
export async function touchEvent(id: string): Promise<void> {
  await db
    .update(events)
    .set({ last_seen: new Date() })
    .where(sql`id = ${id}::uuid`)
}
