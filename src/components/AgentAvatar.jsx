export default function AgentAvatar({ agent, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-11 h-11 text-xs',
    lg: 'w-16 h-16 text-base',
  }
  const isLeadership = agent.tier === 'leadership'
  return (
    <div
      className={`${sizes[size]} shrink-0 rounded-full flex items-center justify-center font-display font-semibold tracking-wide border ${
        isLeadership
          ? 'bg-gradient-to-br from-[color:var(--color-gold-dim)]/30 to-transparent border-[color:var(--color-gold)] text-[color:var(--color-gold-bright)]'
          : 'bg-[color:var(--color-surface-2)] border-[color:var(--color-line)] text-[color:var(--color-ivory-dim)]'
      }`}
      title={agent.role}
    >
      {agent.initials}
    </div>
  )
}
