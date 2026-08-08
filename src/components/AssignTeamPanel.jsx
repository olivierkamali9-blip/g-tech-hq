import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot } from '../lib/context'
import { fetchDynamicAgents } from '../lib/dynamicAgents'
import { POOL, LEADERSHIP, ALL_AGENTS } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import { Users, Star, X, Wand2, Loader2 } from 'lucide-react'

const MANAGER = LEADERSHIP.find(a => a.id === 'manager')

export default function AssignTeamPanel({ project, projectAgents, onUpdate }) {
  const [asking, setAsking] = useState(false)
  const [dynamicAgents, setDynamicAgents] = useState([])

  useEffect(() => { fetchDynamicAgents().then(setDynamicAgents) }, [projectAgents])

  const allPoolAgents = [...POOL, ...dynamicAgents]
  const assignedIds = projectAgents.map(pa => pa.agent_id)
  const assigned = allPoolAgents.filter(a => assignedIds.includes(a.id))
  const allKnown = [...ALL_AGENTS, ...dynamicAgents]
  const lead = allKnown.find(a => a.id === project.lead_agent_id)

  function roleOf(agentId) {
    return projectAgents.find(pa => pa.agent_id === agentId)?.role_in_project
  }

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
      const poolList = allPoolAgents.map(a => `${a.id} = ${a.name} (${a.role} — ${a.title})`).join('\n')
      const raw = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\nConstitue l'équipe pour le projet "${project.name}" (description : ${project.description}). Voici les agents disponibles dans le réservoir, avec leurs identifiants exacts :\n${poolList}\n\nRègle stricte : choisis SEULEMENT les agents dont la compétence est réellement nécessaire pour CE projet précis — pas toute l'équipe par défaut. La plupart des projets n'ont besoin que de 2 à 4 agents. Justifie mentalement chaque choix par la compétence requise avant de répondre.\n\nRéponds UNIQUEMENT avec ce format exact, une ligne EQUIPE par agent choisi, rien d'autre :\nCHEF: <id de l'agent chef de projet>\nEQUIPE: <id> | <rôle précis de cet agent dans CE projet en une courte phrase>\nEQUIPE: <id> | <rôle précis de cet agent dans CE projet en une courte phrase>`,
        [{ role: 'user', content: 'Constitue l\'équipe maintenant, uniquement les agents nécessaires.' }]
      )
      const chefMatch = raw.match(/CHEF:\s*([a-z0-9-]+)/i)
      const chefId = chefMatch?.[1]?.trim()
      const equipeLines = [...raw.matchAll(/EQUIPE:\s*([a-z0-9-]+)\s*\|\s*(.+)/gi)]
      const equipe = equipeLines
        .map(m => ({ agent_id: m[1].trim(), role_in_project: m[2].trim() }))
        .filter(e => allPoolAgents.some(a => a.id === e.agent_id))

      if (equipe.length > 0) {
        await supabase.from('project_agents').delete().eq('project_id', project.id)
        await supabase.from('project_agents').insert(equipe.map(e => ({ project_id: project.id, ...e })))
      }
      if (chefId && allPoolAgents.some(a => a.id === chefId)) {
        await supabase.from('projects').update({ lead_agent_id: chefId }).eq('id', project.id)
      }
      await supabase.from('activity_log').insert({
        project_id: project.id,
        label: `${MANAGER.name} a constitué l'équipe de « ${project.name} » (${equipe.length} agent${equipe.length > 1 ? 's' : ''})`,
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
        <div className="space-y-2 mb-3">
          {assigned.map(a => (
            <div key={a.id} className="px-2 py-1.5 rounded-md hover:bg-[color:var(--color-surface)] group">
              <div className="flex items-center justify-between text-xs">
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
              {roleOf(a.id) && (
                <p className="text-[10px] text-[color:var(--color-mute)] mt-0.5 pl-7">{roleOf(a.id)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="mb-3">
        <summary className="text-xs text-[color:var(--color-mute)] cursor-pointer hover:text-[color:var(--color-gold)]">+ Ajouter manuellement</summary>
        <div className="mt-2 space-y-1">
          {allPoolAgents.filter(a => !assignedIds.includes(a.id)).map(a => (
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
