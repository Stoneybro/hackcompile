'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HackathonEvent } from '@/types'
import EventCard from '@/components/EventCard'
import FilterBar from '@/components/FilterBar'

const ITEMS_PER_PAGE = 20

function isNew(event: HackathonEvent): boolean {
  if (!event.first_seen) return false
  const d = new Date(event.first_seen)
  const now = new Date()
  return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
}

function isUpcoming(event: HackathonEvent): boolean {
  if (!event.deadline) return false
  return new Date(event.deadline) >= new Date()
}

export default function DashboardPage() {
  const [events, setEvents] = useState<HackathonEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ecosystem, setEcosystem] = useState('')
  const [type, setType] = useState('')
  const [showLow, setShowLow] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (showLow) params.set('lowConfidence', 'true')
        const res = await fetch(`/api/events?${params}`)
        if (!res.ok) throw new Error('Failed to fetch events')
        const data: HackathonEvent[] = await res.json()
        setEvents(data)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [showLow])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (ecosystem && e.ecosystem?.toLowerCase() !== ecosystem.toLowerCase()) return false
      if (type && e.event_type !== type) return false
      return true
    })
  }, [events, ecosystem, type])

  const upcoming = useMemo(() => filtered.filter(isUpcoming).sort((a, b) => {
    return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
  }), [filtered])

  const recentlyDiscovered = useMemo(() => filtered.filter(isNew).sort((a, b) => {
    return new Date(b.first_seen!).getTime() - new Date(a.first_seen!).getTime()
  }), [filtered])

  const allSorted = useMemo(() => [...filtered].sort((a, b) => {
    return new Date(b.first_seen!).getTime() - new Date(a.first_seen!).getTime()
  }), [filtered])

  const paged = allSorted.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = paged.length < allSorted.length

  const ecosystems = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => { if (e.ecosystem) set.add(e.ecosystem) })
    return [...set].sort()
  }, [events])

  const types = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => { if (e.event_type) set.add(e.event_type) })
    return [...set]
  }, [events])

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div>
            <div className="header-eyebrow">● LIVE SIGNAL</div>
            <h1 className="dashboard-title">HACKATHON RADAR</h1>
            <p className="dashboard-subtitle">
              Intelligence harvested from GitHub READMEs · Updated every 6 hours
            </p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-number">{events.length}</span>
              <span className="stat-label">EVENTS</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{upcoming.length}</span>
              <span className="stat-label">UPCOMING</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{recentlyDiscovered.length}</span>
              <span className="stat-label">NEW</span>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        <FilterBar
          ecosystems={ecosystems}
          types={types}
          selectedEcosystem={ecosystem}
          selectedType={type}
          showLowConfidence={showLow}
          onEcosystem={setEcosystem}
          onType={setType}
          onLowConfidence={setShowLow}
        />

        {loading && (
          <div className="loading-state">
            <div className="loading-pulse" />
            <span>SCANNING SIGNAL…</span>
          </div>
        )}

        {error && (
          <div className="error-state">⚠ {error}</div>
        )}

        {!loading && !error && (
          <>
            {upcoming.length > 0 && (
              <section className="dashboard-section">
                <h2 className="section-title">
                  <span className="section-indicator upcoming-indicator" />
                  UPCOMING
                  <span className="section-count">{upcoming.length}</span>
                </h2>
                <div className="event-grid">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} isNew={isNew(e)} />
                  ))}
                </div>
              </section>
            )}

            {recentlyDiscovered.length > 0 && (
              <section className="dashboard-section">
                <h2 className="section-title">
                  <span className="section-indicator new-indicator" />
                  RECENTLY DISCOVERED
                  <span className="section-count">{recentlyDiscovered.length}</span>
                </h2>
                <div className="event-grid">
                  {recentlyDiscovered.map((e) => (
                    <EventCard key={e.id} event={e} isNew />
                  ))}
                </div>
              </section>
            )}

            <section className="dashboard-section">
              <h2 className="section-title">
                <span className="section-indicator all-indicator" />
                ALL EVENTS
                <span className="section-count">{allSorted.length}</span>
              </h2>
              <div className="event-grid">
                {paged.map((e) => (
                  <EventCard key={e.id} event={e} isNew={isNew(e)} />
                ))}
              </div>
              {hasMore && (
                <button
                  id="load-more-btn"
                  className="load-more-btn"
                  onClick={() => setPage((p) => p + 1)}
                >
                  LOAD MORE ({allSorted.length - paged.length} remaining)
                </button>
              )}
            </section>

            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <p>No signals detected. Try adjusting your filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
