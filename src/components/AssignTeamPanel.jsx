import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot } from '../lib/context'
import { POOL, LEADERSHIP, ALL_AGENTS } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import { Users, Star, X, Wand2, Loader2 } from 'lucide-react'

const MANAGER = LEADERSHIP.find(a => a.id === 'manager')

export default function AssignTeamPanel({ project, projectAgents, onUpdate }) {
  const [asking, setAsking] = useState(false)
  const assignedIds = projectAgents.map(pa => pa.agent_id)
  const assigned = POOL.filter(a => assignedIds.includes(a.id))
  const lead = ALL_AGENTS.find(a => a.id === project.lead_agent_id)

  async function toggleAgent(agentId) {
    if (assignedIds.includes(agentId)) {
      await supabase.from('project_agents').delete().eq('project_id', project.id).eq('agent_id', agentId)
    } else {
      await supabase.from('project_agents').insert({ project_id: project.id, agent_id: agentId })
    }
    onUpdate()
  }

  async function setLead(agentId) {
    await supabase.from('projects').update({ lead_agent_id: agentId }).eq('id', project.id)
    onUpdate()
  }

  async function askManagerToBuild() {
    setAsking(true)
    try {
      const orgContext = await getOrgSnapshot()
      const poolList = POOL.map(a => `${a.id} = ${a.name} (${a.role})`).join('\n')
      const raw = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\nConstitue l'équipe pour le projet "${project.name}" (description : ${project.description}). Voici les agents disponibles dans le réservoir, avec leurs identifiants exacts :\n${poolList}\n\nRéponds UNIQUEMENT avec ce format exact, rien d'autre, pas de phrase avant ou après :\nCHEF: <id de l'agent chef de projet>\nEQUIPE: <id1>, <id2>, <id3>`,
        [{ role: 'user', content: 'Constitue l\'équipe maintenant.' }]
      )
      const chefMatch = raw.match(/CHEF:\s*([a-z0-9-]+)/i)
      const equipeMatch = raw.match(/EQUIPE:\s*(.+)/i)
      const chefId = chefMatch?.[1]?.trim()
      const equipeIds = equipeMatch?.[1]?.split(',').map(s => s.trim()).filter(id => POOL.some(a => a.id === id)) || []

      if (equipeIds.length > 0) {
        await supabase.from('project_agents').delete().eq('project_id', project.id)
        await supabase.from('project_agents').insert(equipeIds.map(agent_id => ({ project_id: project.id, agent_id })))
      }
      if (chefId && POOL.some(a => a.id === chefId)) {
        await supabase.from('projects').update({ lead_agent_id: chefId }).eq('id', project.id)
      }
      await supabase.from('activity_log').insert({
        project_id: project.id,
        label: `${MANAGER.name} a constitué l'équipe de « ${project.name} »`,
      })
      onUpdate()
    } catch (e) {
      alert(`Erreur : ${e.message}`)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-3">
        <Users size={13} /> Équipe du projet
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-[color:var(--color-mute)] mb-3">Personne d'assigné pour l'instant.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {assigned.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-[color:var(--color-surface)] group">
              <div className="flex items-center gap-2">
                <AgentAvatar agent={a} size="sm" />
                <span>{a.name}</span>
                {lead?.id === a.id && <span className="text-[color:var(--color-gold)] text-[10px]">Chef de projet</span>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => setLead(a.id)} title="Désigner chef de projet" className="text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
                  <Star size={12} fill={lead?.id === a.id ? 'currentColor' : 'none'} />
                </button>
                <button onClick={() => toggleAgent(a.id)} title="Retirer" className="text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]">
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="mb-3">
        <summary className="text-xs text-[color:var(--color-mute)] cursor-pointer hover:text-[color:var(--color-gold)]">+ Ajouter manuellement</summary>
        <div className="mt-2 space-y-1">
          {POOL.filter(a => !assignedIds.includes(a.id)).map(a => (
            <button
              key={a.id}
              onClick={() => toggleAgent(a.id)}
              className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-[color:var(--color-surface)] text-left"
            >
              <AgentAvatar agent={a} size="sm" />
              {a.name} — {a.role}
            </button>
          ))}
        </div>
      </details>

      <button
        onClick={askManagerToBuild}
        disabled={asking}
        className="w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg border border-[color:var(--color-gold-dim)] text-[color:var(--color-gold-bright)] hover:bg-[color:var(--color-gold)]/10 disabled:opacity-50"
      >
        {asking ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
        {asking ? 'Adrien réfléchit...' : "Laisser Adrien constituer l'équipe"}
      </button>
    </div>
  )
}
