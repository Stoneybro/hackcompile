import type { HackathonEvent } from '@/types'
import ConfidenceBadge from '@/components/ConfidenceBadge'
import EcosystemBadge from '@/components/EcosystemBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getEvent(id: string): Promise<HackathonEvent | null> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/events/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch event')
  return res.json()
}

const TYPE_LABELS: Record<string, string> = {
  hackathon: 'HACKATHON',
  grant: 'GRANT',
  accelerator: 'ACCELERATOR',
  builder_program: 'BUILDER PROGRAM',
  bounty: 'BOUNTY',
  unknown: 'UNKNOWN',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) notFound()

  return (
    <main className="detail-page">
      <div className="detail-container">
        <Link href="/" className="back-link">← RADAR</Link>

        <div className="detail-card">
          <div className="detail-header">
            <div className="detail-badges">
              <span className="type-badge">
                {TYPE_LABELS[event.event_type ?? 'unknown'] ?? 'UNKNOWN'}
              </span>
              <EcosystemBadge ecosystem={event.ecosystem} />
              <ConfidenceBadge confidence={event.confidence} />
            </div>
            <h1 className="detail-title">{event.hackathon_name}</h1>
            {event.description && (
              <p className="detail-description">{event.description}</p>
            )}
          </div>

          <div className="detail-actions">
            <a
              id="detail-search-btn"
              href={event.google_search_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn action-btn-search action-btn-large"
            >
              ⌕ Search Google
            </a>
            {event.official_url && (
              <a
                id="detail-site-btn"
                href={event.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn action-btn-site action-btn-large"
              >
                ↗ Official Site
              </a>
            )}
          </div>

          <div className="detail-fields">
            <div className="detail-field">
              <span className="field-label">ORGANIZER</span>
              <span className="field-value">{event.organizer ?? '—'}</span>
            </div>
            <div className="detail-field">
              <span className="field-label">PRIZE POOL</span>
              <span className="field-value prize-value">{event.prize_pool ?? '—'}</span>
            </div>
            <div className="detail-field">
              <span className="field-label">DEADLINE</span>
              <span className="field-value">{formatDate(event.deadline)}</span>
            </div>
            <div className="detail-field">
              <span className="field-label">STATUS</span>
              <span className={`field-value status-${event.status ?? 'unknown'}`}>
                {(event.status ?? 'unknown').toUpperCase()}
              </span>
            </div>
            <div className="detail-field">
              <span className="field-label">FIRST SEEN</span>
              <span className="field-value">{formatDate(event.first_seen)}</span>
            </div>
            <div className="detail-field">
              <span className="field-label">LAST SEEN</span>
              <span className="field-value">{formatDate(event.last_seen)}</span>
            </div>
            {event.source_repo && (
              <div className="detail-field">
                <span className="field-label">SOURCE REPO</span>
                <a
                  id="detail-repo-link"
                  href={event.source_repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="field-link"
                >
                  {event.source_repo}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
