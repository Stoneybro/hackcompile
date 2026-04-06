import type { HackathonEvent } from '@/types'

interface Props {
  confidence: HackathonEvent['confidence']
}

const labels: Record<string, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

const colors: Record<string, string> = {
  high: 'badge-confidence-high',
  medium: 'badge-confidence-medium',
  low: 'badge-confidence-low',
}

export default function ConfidenceBadge({ confidence }: Props) {
  const level = confidence ?? 'low'
  return (
    <span className={`confidence-badge ${colors[level] ?? colors.low}`} title={`Confidence: ${level}`}>
      <span className="confidence-dot" />
      {labels[level] ?? 'LOW'}
    </span>
  )
}
