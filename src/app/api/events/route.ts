import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { and, gte, lte, eq, desc, asc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const ecosystem = searchParams.get('ecosystem')
  const type = searchParams.get('type')
  const upcoming = searchParams.get('upcoming') === 'true'
  const showLowConfidence = searchParams.get('lowConfidence') === 'true'

  const today = new Date().toISOString().split('T')[0]

  const conditions = []

  if (ecosystem) conditions.push(eq(events.ecosystem, ecosystem))
  if (type) conditions.push(eq(events.event_type, type))
  if (upcoming) conditions.push(gte(events.deadline, today))
  if (!showLowConfidence) {
    // exclude low confidence by default
    conditions.push(sql`${events.confidence} != 'low'`)
  }

  const rows = await db
    .select()
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      upcoming
        ? asc(events.deadline)
        : desc(events.first_seen)
    )

  return Response.json(rows)
}
