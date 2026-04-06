interface Props {
  ecosystem: string | null
}

const ECOSYSTEM_COLORS: Record<string, string> = {
  ethereum: '#627eea',
  solana: '#9945ff',
  base: '#0052ff',
  polygon: '#8247e5',
  avalanche: '#e84142',
  near: '#00c08b',
  cosmos: '#2e3148',
  cardano: '#0033ad',
  aptos: '#00d4a3',
  sui: '#4da2ff',
  polkadot: '#e6007a',
}

function getColor(eco: string): string {
  const normalized = eco.toLowerCase()
  for (const [key, color] of Object.entries(ECOSYSTEM_COLORS)) {
    if (normalized.includes(key)) return color
  }
  return '#4a5568'
}

export default function EcosystemBadge({ ecosystem }: Props) {
  if (!ecosystem) return null
  const color = getColor(ecosystem)
  return (
    <span
      className="ecosystem-badge"
      style={{ backgroundColor: color + '22', borderColor: color + '66', color }}
    >
      {ecosystem}
    </span>
  )
}
