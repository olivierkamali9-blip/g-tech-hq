import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_AGENTS } from '../data/agents'
import { fetchDynamicAgents } from '../lib/dynamicAgents'
import AgentAvatar from '../components/AgentAvatar'
import { Trophy, CheckCircle2, XCircle, MessageSquare } from 'lucide-react'

export default function Productivity() {
  const [ranking, setRanking] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: tasks }, { data: messages }, dynamicAgents] = await Promise.all([
        supabase.from('project_tasks').select('agent_id, status'),
        supabase.from('messages').select('author_id'),
        fetchDynamicAgents(),
      ])

      const allKnown = [...ALL_AGENTS, ...dynamicAgents]
      const stats = {}
      for (const a of allKnown) stats[a.id] = { agent: a, done: 0, failed: 0, messages: 0 }

      for (const t of tasks || []) {
        if (!stats[t.agent_id]) continue
        if (t.status === 'done') stats[t.agent_id].done++
        if (t.status === 'failed') stats[t.agent_id].failed++
      }
      for (const m of messages || []) {
        if (stats[m.author_id]) stats[m.author_id].messages++
      }

      // Score simple : tâches terminées pèsent le plus, messages = contribution générale, échecs pénalisent légèrement
      const list = Object.values(stats)
        .map(s => ({ ...s, score: s.done * 10 + s.messages * 1 - s.failed * 3 }))
        .filter(s => s.done + s.messages + s.failed > 0)
        .sort((a, b) => b.score - a.score)

      setRanking(list)
    }
    load()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Productivité</div>
        <h1 className="font-display text-3xl">Qui performe le mieux</h1>
        <p className="text-[color:var(--color-ivory-dim)] mt-2 text-sm">
          Classement basé sur les tâches réellement terminées, la contribution générale, et les échecs.
        </p>
      </div>

      {ranking === null ? (
        <p className="text-sm text-[color:var(--color-mute)]">Chargement...</p>
      ) : ranking.length === 0 ? (
        <div className="border border-dashed border-[color:var(--color-line)] rounded-lg p-12 text-center">
          <Trophy size={28} className="mx-auto mb-3 text-[color:var(--color-mute)]" />
          <p className="text-sm text-[color:var(--color-ivory-dim)]">Pas encore assez de travail accompli pour établir un classement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((r, i) => (
            <div key={r.agent.id} className={`flex items-center gap-4 p-4 rounded-lg border ${
              i === 0 ? 'border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/[0.05]' : 'border-[color:var(--color-line)]'
            }`}>
              <div className={`font-display text-xl w-7 text-center shrink-0 ${i === 0 ? 'text-[color:var(--color-gold-bright)]' : 'text-[color:var(--color-mute)]'}`}>
                {i + 1}
              </div>
              <AgentAvatar agent={r.agent} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.agent.name}</div>
                <div className="text-[11px] text-[color:var(--color-mute)]">{r.agent.role}</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-[color:var(--color-ivory-dim)] shrink-0">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[color:var(--color-good)]" /> {r.done}</span>
                <span className="flex items-center gap-1"><MessageSquare size={12} className="text-[color:var(--color-mute)]" /> {r.messages}</span>
                {r.failed > 0 && <span className="flex items-center gap-1"><XCircle size={12} className="text-[color:var(--color-danger)]" /> {r.failed}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
