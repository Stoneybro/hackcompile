import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rows = await db
    .select()
    .from(events)
    .where(sql`${events.id} = ${id}::uuid`)
    .limit(1)

  if (rows.length === 0) {
    return new Response('Not Found', { status: 404 })
  }

  return Response.json(rows[0])
}
