export interface HackathonEvent {
  id: string
  hackathon_name: string
  organizer: string | null
  ecosystem: string | null
  event_type: string | null
  description: string | null
  prize_pool: string | null
  deadline: string | null
  status: string | null
  official_url: string | null
  google_search_url: string
  source_repo: string | null
  confidence: string | null
  first_seen: string | null
  last_seen: string | null
}
