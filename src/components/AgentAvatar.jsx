// Avatar "mini-personne" — silhouette professionnelle générée en SVG,
// pas de photo générique : une teinte et un anneau dérivés du rôle de l'agent.

const PALETTE = [
  '#C9A227', '#8A9A8B', '#9C7A54', '#6E8AA6', '#A6746E', '#7D8A6E', '#8A7DA6', '#A68A5C',
]

function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h
}

export default function AgentAvatar({ agent, size = 'md' }) {
  const dims = { sm: 32, md: 44, lg: 64 }
  const px = dims[size]
  const isLeadership = agent.tier === 'leadership'
  const tone = isLeadership ? '#C9A227' : PALETTE[hashName(agent.name) % PALETTE.length]

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{
        width: px,
        height: px,
        background: 'var(--color-surface-2)',
        border: `1.5px solid ${isLeadership ? 'var(--color-gold)' : 'var(--color-line)'}`,
      }}
      title={`${agent.name} — ${agent.role}`}
    >
      <svg width={px * 0.62} height={px * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.2" r="4" fill={tone} />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill={tone} opacity="0.85" />
      </svg>
    </div>
  )
}
