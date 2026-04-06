'use client'

interface Props {
  ecosystems: string[]
  types: string[]
  selectedEcosystem: string
  selectedType: string
  showLowConfidence: boolean
  onEcosystem: (v: string) => void
  onType: (v: string) => void
  onLowConfidence: (v: boolean) => void
}

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'grant', label: 'Grant' },
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'builder_program', label: 'Builder Program' },
  { value: 'bounty', label: 'Bounty' },
  { value: 'unknown', label: 'Unknown' },
]

export default function FilterBar({
  ecosystems,
  types,
  selectedEcosystem,
  selectedType,
  showLowConfidence,
  onEcosystem,
  onType,
  onLowConfidence,
}: Props) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label className="filter-label" htmlFor="ecosystem-filter">ECOSYSTEM</label>
        <select
          id="ecosystem-filter"
          className="filter-select"
          value={selectedEcosystem}
          onChange={(e) => onEcosystem(e.target.value)}
        >
          <option value="">All Ecosystems</option>
          {ecosystems.map((eco) => (
            <option key={eco} value={eco}>{eco}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="type-filter">TYPE</label>
        <select
          id="type-filter"
          className="filter-select"
          value={selectedType}
          onChange={(e) => onType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="filter-group filter-group-toggle">
        <label className="filter-label" htmlFor="low-conf-toggle">SHOW LOW CONFIDENCE</label>
        <button
          id="low-conf-toggle"
          role="switch"
          aria-checked={showLowConfidence}
          className={`toggle-btn ${showLowConfidence ? 'toggle-on' : 'toggle-off'}`}
          onClick={() => onLowConfidence(!showLowConfidence)}
        >
          {showLowConfidence ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
