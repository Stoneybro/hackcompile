import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rawRepos, events } from '@/lib/db/schema'
import { searchRepos, fetchReadme } from '@/lib/github'
import { extractHackathonInfo } from '@/lib/extract'
import { findSimilarEvent, touchEvent } from '@/lib/deduplicate'
import { eq } from 'drizzle-orm'

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  // Auth check — Vercel Cron sets Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const stats = {
    reposFound: 0,
    reposAlreadySeen: 0,
    reposProcessed: 0,
    eventsInserted: 0,
    eventsDeduplicated: 0,
    eventsSkipped: 0,
    errors: 0,
  }

  try {
    // 1. Search GitHub for repos
    const repos = await searchRepos(7)
    stats.reposFound = repos.length

    for (const repo of repos) {
      // 2. Check if already logged in raw_repos
      const existing = await db
        .select({ id: rawRepos.id, processed: rawRepos.processed })
        .from(rawRepos)
        .where(eq(rawRepos.repo_url, repo.url))
        .limit(1)

      if (existing.length > 0) {
        if (existing[0].processed) {
          stats.reposAlreadySeen++
          continue // already successfully processed, skip
        }
        // If it exists but processed is false, it means it failed last time. We should retry it.
      } else {
        // 3. Insert into raw_repos queue
        await db.insert(rawRepos).values({
          repo_url: repo.url,
          repo_name: repo.name,
          processed: false,
        })
      }

      // 4. Fetch README (already truncated to 3000 chars inside fetchReadme)
      const readme = await fetchReadme(repo.name)
      if (!readme) {
        await db.update(rawRepos).set({ processed: true }).where(eq(rawRepos.repo_url, repo.url))
        stats.eventsSkipped++
        continue
      }

      // 5. Extract hackathon info via Gemini
      const extracted = await extractHackathonInfo(readme)

      // If extraction failed entirely or returned no name, skip
      if (!extracted || !extracted.hackathon_name) {
        await db.update(rawRepos).set({ processed: true }).where(eq(rawRepos.repo_url, repo.url))
        stats.eventsSkipped++
        stats.reposProcessed++
        continue
      }

      // 6. Deduplicate by similarity
      const duplicateId = await findSimilarEvent(extracted.hackathon_name)

      if (duplicateId) {
        await touchEvent(duplicateId)
        await db.update(rawRepos).set({ processed: true }).where(eq(rawRepos.repo_url, repo.url))
        stats.eventsDeduplicated++
        stats.reposProcessed++
      } else {
        // 7. Generate google_search_url
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          extracted.hackathon_name + ' hackathon'
        )}`

        // 8. Insert new event
        await db.insert(events).values({
          hackathon_name: extracted.hackathon_name,
          organizer: extracted.organizer ?? null,
          ecosystem: extracted.ecosystem ?? null,
          event_type: extracted.event_type ?? 'unknown',
          description: extracted.description ?? null,
          prize_pool: extracted.prize_pool ?? null,
          deadline: extracted.deadline ?? null,
          status: 'active',
          official_url: extracted.official_url ?? null,
          google_search_url: googleSearchUrl,
          source_repo: repo.url,
          confidence: extracted.confidence,
        })

        await db.update(rawRepos).set({ processed: true }).where(eq(rawRepos.repo_url, repo.url))
        stats.eventsInserted++
        stats.reposProcessed++
      }

      // 5-second delay between README fetches to respect Gemini 15 RPM rate limits
      await new Promise((r) => setTimeout(r, 5000))

      // Only process 3 repos per run to avoid hitting free tier limits
      if (stats.reposProcessed >= 3) break
    }
  } catch (err) {
    console.error('[collect] Unhandled error:', err)
    stats.errors++
  }

  console.log('[collect] Run complete:', stats)

  return Response.json({ success: true, stats })
}
