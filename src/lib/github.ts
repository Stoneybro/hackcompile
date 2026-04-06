const GITHUB_API_BASE = 'https://api.github.com'

// Build headers — include token if available (5000/hr), fallback is unauthenticated (10/min)
function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'hackcompile-radar/1.0',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: buildHeaders() })
    if (res.status === 403 || res.status === 429) {
      if (attempt < retries) {
        console.warn(`[github] Rate limited (${res.status}), waiting 60s…`)
        await new Promise((r) => setTimeout(r, 60_000))
        continue
      }
    }
    return res
  }
  throw new Error(`Failed to fetch after retries: ${url}`)
}

export interface GithubRepo {
  url: string
  name: string
}

const SEARCH_TERMS = [
  'hackathon in:readme',
  '"builder program" in:readme',
  '"grant program" in:readme',
  '"bounty program" in:readme',
]

/**
 * Run all 4 search queries (smaller batch: per_page=30 to stay within Vercel timeout),
 * combine and deduplicate by repo URL before returning.
 */
export async function searchRepos(daysAgo = 7): Promise<GithubRepo[]> {
  const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const seen = new Set<string>()
  const repos: GithubRepo[] = []

  for (const term of SEARCH_TERMS) {
    const query = encodeURIComponent(`${term} created:>${cutoff}`)
    const url = `${GITHUB_API_BASE}/search/repositories?q=${query}&sort=created&order=desc&per_page=30`

    try {
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        console.error(`[github] Search failed for "${term}": ${res.status}`)
        continue
      }
      const data = await res.json()
      for (const item of data.items ?? []) {
        const repoUrl: string = item.html_url
        if (!seen.has(repoUrl)) {
          seen.add(repoUrl)
          repos.push({ url: repoUrl, name: item.full_name })
        }
      }
    } catch (err) {
      console.error(`[github] Search error for "${term}":`, err)
    }

    // Small delay between search queries to be polite to the API
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`[github] Found ${repos.length} unique repos across ${SEARCH_TERMS.length} queries`)
  return repos
}

/**
 * Fetch README content for a repo (by full_name e.g. "owner/repo").
 * Truncated to 3000 chars before passing to the LLM.
 */
export async function fetchReadme(repoFullName: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${repoFullName}/readme`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    const data = await res.json()

    // README is base64-encoded
    if (data.encoding === 'base64' && data.content) {
      const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      return decoded.slice(0, 3000)
    }
    return null
  } catch (err) {
    console.error(`[github] README fetch error for ${repoFullName}:`, err)
    return null
  }
}
