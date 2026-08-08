import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LEADERSHIP, POOL, ENGINE_LABEL } from '../data/agents'
import { fetchDynamicAgents, nextAvailableReserveName, createDynamicAgent } from '../lib/dynamicAgents'
import AgentAvatar from '../components/AgentAvatar'
import { Plus, Loader2 } from 'lucide-react'

const ENGINE_OPTIONS = Object.keys(ENGINE_LABEL)

export default function Team() {
  const [dynamicAgents, setDynamicAgents] = useState([])
  const [assignments, setAssignments] = useState({}) // agentId -> projectName
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', title: '', engine: 'gemini' })
  const [suggestedName, setSuggestedName] = useState('')

  async function load() {
    setLoading(true)
    const [dyn, { data: pa }, { data: projects }] = await Promise.all([
      fetchDynamicAgents(),
      supabase.from('project_agents').select('agent_id, project_id'),
      supabase.from('projects').select('id, name'),
    ])
    setDynamicAgents(dyn)
    const map = {}
    for (const row of pa || []) {
      const project = projects.find(p => p.id === row.project_id)
      if (project) map[row.agent_id] = project.name
    }
    setAssignments(map)
    const name = await nextAvailableReserveName()
    setSuggestedName(name || '')
    setForm(f => ({ ...f, name: name || '' }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submitCreate() {
    if (!form.name.trim() || !form.role.trim() || !form.title.trim()) return
    await createDynamicAgent(form)
    setCreating(false)
    load()
  }

  const allPool = [...POOL, ...dynamicAgents]

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Équipe</div>
          <h1 className="font-display text-3xl">Qui compose G-Tech HQ</h1>
          <p className="text-[color:var(--color-ivory-dim)] mt-2 text-sm max-w-xl">
            La direction supervise en permanence. Le réservoir de talents attend d'être assigné par le Manager, projet par projet.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="shrink-0 w-9 h-9 rounded-full border border-[color:var(--color-line)] flex items-center justify-center hover:border-[color:var(--color-gold-dim)]">
          <Plus size={16} />
        </button>
      </div>

      {creating && (
        <div className="mb-10 p-5 border border-[color:var(--color-gold-dim)] rounded-lg bg-[color:var(--color-surface)] space-y-3">
          <div className="text-xs text-[color:var(--color-mute)]">
            Prénom suggéré (unique, jamais réutilisé) : <span className="text-[color:var(--color-gold)]">{suggestedName}</span>
          </div>
          <input
            value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder="Poste (ex : Data Analyst, Motion Designer...)"
            className="w-full bg-[color:var(--color-void)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none"
          />
          <input
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Sa fonction en une phrase"
            className="w-full bg-[color:var(--color-void)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none"
          />
          <select
            value={form.engine} onChange={e => setForm(f => ({ ...f, engine: e.target.value }))}
            className="bg-[color:var(--color-void)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none"
          >
            {ENGINE_OPTIONS.map(e => <option key={e} value={e}>{ENGINE_LABEL[e]}</option>)}
          </select>
          <button onClick={submitCreate} className="text-xs px-3 py-2 rounded-md bg-[color:var(--color-gold)] text-[color:var(--color-void)]">
            Créer {suggestedName}
          </button>
        </div>
      )}

      <h2 className="font-display text-lg mb-4">Direction</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {LEADERSHIP.map(a => <AgentCard key={a.id} agent={a} />)}
      </div>

      <h2 className="font-display text-lg mb-4">Réservoir de talents</h2>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-[color:var(--color-mute)]" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {allPool.map(a => <AgentCard key={a.id} agent={a} assignedTo={assignments[a.id]} />)}
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, assignedTo }) {
  return (
    <div className="p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="flex items-start gap-3 mb-3">
        <AgentAvatar agent={agent} />
        <div>
          <div className="text-sm font-medium">{agent.role}</div>
          <div className="text-[11px] text-[color:var(--color-gold)] mt-0.5">{agent.name}</div>
          <div className="text-[11px] text-[color:var(--color-mute)] font-mono mt-0.5">{ENGINE_LABEL[agent.engine]}</div>
        </div>
      </div>
      <p className="text-xs text-[color:var(--color-ivory-dim)] leading-relaxed">{agent.title}</p>
      {agent.tier === 'pool' && (
        <div className="mt-3 text-[10px] uppercase tracking-wide">
          {assignedTo ? (
            <span className="text-[color:var(--color-good)]">Assigné — {assignedTo}</span>
          ) : (
            <span className="text-[color:var(--color-mute)]">Non assigné</span>
          )}
        </div>
      )}
    </div>
  )
}
