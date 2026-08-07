import { LEADERSHIP, POOL, ENGINE_LABEL } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'

export default function Team() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Équipe</div>
        <h1 className="font-display text-3xl">Qui compose G-Tech HQ</h1>
        <p className="text-[color:var(--color-ivory-dim)] mt-2 text-sm max-w-xl">
          La direction supervise en permanence. Le réservoir de talents attend d'être assigné par le Manager, projet par projet.
        </p>
      </div>

      <h2 className="font-display text-lg mb-4">Direction</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {LEADERSHIP.map(a => <AgentCard key={a.id} agent={a} />)}
      </div>

      <h2 className="font-display text-lg mb-4">Réservoir de talents</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {POOL.map(a => <AgentCard key={a.id} agent={a} unassigned />)}
      </div>
    </div>
  )
}

function AgentCard({ agent, unassigned }) {
  return (
    <div className="p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="flex items-start gap-3 mb-3">
        <AgentAvatar agent={agent} />
        <div>
          <div className="text-sm font-medium font-display">{agent.name}</div>
          <div className="text-xs text-[color:var(--color-gold)] mt-0.5">{agent.role}</div>
          <div className="text-[11px] text-[color:var(--color-mute)] font-mono mt-0.5">{ENGINE_LABEL[agent.engine]}</div>
        </div>
      </div>
      <p className="text-xs text-[color:var(--color-ivory-dim)] leading-relaxed">{agent.title}</p>
      {unassigned && (
        <div className="mt-3 text-[10px] uppercase tracking-wide text-[color:var(--color-mute)]">Non assigné</div>
      )}
    </div>
  )
}
