'use client'

import type { HackathonEvent } from '@/types'
import ConfidenceBadge from './ConfidenceBadge'
import EcosystemBadge from './EcosystemBadge'
import Link from 'next/link'

interface Props {
  event: HackathonEvent
  isNew?: boolean
}

function isDeadlineSoon(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '—'
  return new Date(deadline).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  hackathon: 'HACKATHON',
  grant: 'GRANT',
  accelerator: 'ACCEL',
  builder_program: 'BUILDERS',
  bounty: 'BOUNTY',
  unknown: 'UNKNOWN',
}

export default function EventCard({ event, isNew }: Props) {
  const soon = isDeadlineSoon(event.deadline)

  return (
    <Link href={`/events/${event.id}`} className="event-card-link">
      <div className="event-card">
        <div className="event-card-header">
          <div className="event-card-title-row">
            <h3 className="event-name">{event.hackathon_name}</h3>
            <div className="event-badges">
              {isNew && <span className="new-badge">NEW</span>}
              <span className="type-badge">
                {EVENT_TYPE_LABELS[event.event_type ?? 'unknown'] ?? 'UNKNOWN'}
              </span>
              <ConfidenceBadge confidence={event.confidence} />
            </div>
          </div>
          {event.description && (
            <p className="event-description">{event.description}</p>
          )}
        </div>

        <div className="event-card-meta">
          <div className="meta-row">
            {event.organizer && (
              <span className="meta-item">
                <span className="meta-label">ORG</span>
                <span className="meta-value">{event.organizer}</span>
              </span>
            )}
            <EcosystemBadge ecosystem={event.ecosystem} />
            {event.prize_pool && (
              <span className="prize-badge">💰 {event.prize_pool}</span>
            )}
          </div>

          <div className="meta-row">
            <span className={`meta-item ${soon ? 'deadline-soon' : ''}`}>
              <span className="meta-label">DEADLINE</span>
              <span className="meta-value">{formatDeadline(event.deadline)}</span>
              {soon && <span className="soon-indicator">⚡ SOON</span>}
            </span>
          </div>
        </div>

        <div className="event-card-actions" onClick={(e) => e.preventDefault()}>
          <a
            id={`search-${event.id}`}
            href={event.google_search_url}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn action-btn-search"
          >
            ⌕ Search
          </a>
          {event.official_url && (
            <a
              id={`site-${event.id}`}
              href={event.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn action-btn-site"
            >
              ↗ Official Site
            </a>
          )}
          {event.source_repo && (
            <a
              id={`repo-${event.id}`}
              href={event.source_repo}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn action-btn-repo"
            >
              ⎇ Source
            </a>
          )}
        </div>
      </div>
    </Link>
  )
}
