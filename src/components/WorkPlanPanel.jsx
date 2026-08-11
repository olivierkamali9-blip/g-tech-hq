import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_AGENTS } from '../data/agents'
import { fetchDynamicAgents } from '../lib/dynamicAgents'
import { ListChecks, Pause, Play, CheckCircle2, Circle, Loader2, XCircle, PauseCircle } from 'lucide-react'

const ICONS = {
  pending: <Circle size={13} className="text-[color:var(--color-mute)]" />,
  in_progress: <Loader2 size={13} className="text-[color:var(--color-gold)] animate-spin" />,
  done: <CheckCircle2 size={13} className="text-[color:var(--color-good)]" />,
  failed: <XCircle size={13} className="text-[color:var(--color-danger)]" />,
  blocked: <PauseCircle size={13} className="text-[color:var(--color-warn)]" />,
}

export default function WorkPlanPanel({ project, onProjectUpdate }) {
  const [tasks, setTasks] = useState([])
  const [dynamicAgents, setDynamicAgents] = useState([])

  async function load() {
    const [{ data: t }, dyn] = await Promise.all([
      supabase.from('project_tasks').select('*').eq('project_id', project.id).order('sequence', { ascending: true }),
      fetchDynamicAgents(),
    ])
    setTasks(t || [])
    setDynamicAgents(dyn)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // se rafraîchit tout seul pendant que ça tourne en arrière-plan
    return () => clearInterval(interval)
  }, [project.id])

  if (project.status !== 'en_cours' || tasks.length === 0) return null

  const allKnown = [...ALL_AGENTS, ...dynamicAgents]

  async function togglePause() {
    const { data } = await supabase.from('projects').update({ orchestration_paused: !project.orchestration_paused }).eq('id', project.id).select().single()
    onProjectUpdate(data)
  }

  const done = tasks.filter(t => t.status === 'done').length

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">
          <ListChecks size={13} /> Plan de travail ({done}/{tasks.length})
        </div>
        <button onClick={togglePause} title={project.orchestration_paused ? 'Reprendre' : 'Mettre en pause'} className="text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
          {project.orchestration_paused ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>

      {project.orchestration_paused && (
        <p className="text-[10px] text-[color:var(--color-warn)] mb-2">⏸ En pause — rien n'avance tant que tu ne relances pas.</p>
      )}

      <div className="space-y-2">
        {tasks.map(t => {
          const agent = allKnown.find(a => a.id === t.agent_id)
          return (
            <div key={t.id} className="flex items-start gap-2 text-xs">
              {ICONS[t.status]}
              <div>
                {agent && (
                  <span className="text-[color:var(--color-gold)] font-medium mr-1">{agent.name} :</span>
                )}
                <span className={t.status === 'done' ? 'text-[color:var(--color-mute)] line-through' : 'text-[color:var(--color-ivory-dim)]'}>
                  {t.description}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[color:var(--color-mute)] mt-2">Une étape avance environ toutes les 5 minutes, même app fermée.</p>
    </div>
  )
}
