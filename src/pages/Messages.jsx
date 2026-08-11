import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot, getAgentMemory, getProjectReality, PLAIN_LANGUAGE } from '../lib/context'
import { ALL_AGENTS, LEADERSHIP } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import ReactMarkdown from 'react-markdown'
import { Send, Trash2, PlayCircle } from 'lucide-react'
import { markThreadRead } from '../lib/notifications'

function hasUnread(thread, agentId) {
  try {
    const map = JSON.parse(localStorage.getItem('gtech-hq-dm-read') || '{}')
    const lastRead = map[agentId]
    return (thread || []).some(m => m.author_id !== 'user' && (!lastRead || new Date(m.created_at) > new Date(lastRead)))
  } catch { return false }
}

export default function Messages() {
  const [activeId, setActiveId] = useState(LEADERSHIP[0].id)
  const [threads, setThreads] = useState({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const active = ALL_AGENTS.find(a => a.id === activeId)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('dm_messages').select('*').order('created_at', { ascending: true })
      const grouped = {}
      for (const m of data || []) {
        grouped[m.agent_id] = grouped[m.agent_id] || []
        grouped[m.agent_id].push(m)
      }
      setThreads(grouped)
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threads, activeId])

  useEffect(() => {
    markThreadRead(activeId)
  }, [activeId, threads])

  const currentThread = threads[activeId] || []
  // Le projet le plus récent mentionné dans ce fil (les DM liées à un projet le sont automatiquement)
  const linkedProjectId = [...currentThread].reverse().find(m => m.project_id)?.project_id

  async function deleteMessage(messageId) {
    if (typeof messageId === 'string' && messageId.startsWith('err-')) {
      setThreads(prev => ({ ...prev, [activeId]: prev[activeId].filter(m => m.id !== messageId) }))
      return
    }
    if (!confirm('Supprimer ce message ?')) return
    await supabase.from('dm_messages').delete().eq('id', messageId)
    setThreads(prev => ({ ...prev, [activeId]: prev[activeId].filter(m => m.id !== messageId) }))
  }

  async function send() {
    if (!input.trim()) return
    setSending(true)
    const text = input.trim()
    setInput('')

    const userMsg = { agent_id: activeId, author_id: 'user', content: text, project_id: linkedProjectId || null }
    const { data: saved } = await supabase.from('dm_messages').insert(userMsg).select().single()
    setThreads(prev => ({ ...prev, [activeId]: [...(prev[activeId] || []), saved] }))

    // Ta réponse relance automatiquement les tâches bloquées de ce projet (elles seules, pas les autres)
    if (linkedProjectId) {
      await supabase.from('project_tasks').update({ status: 'pending' }).eq('project_id', linkedProjectId).eq('status', 'blocked')
    }

    try {
      const history = [...currentThread, saved].slice(-20).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const projectReality = linkedProjectId ? await getProjectReality(linkedProjectId, active.id) : ''
      const reply = await askAgent(
        active.engine,
        `Tu es ${active.name}, "${active.role}" dans G-Tech HQ. C'est une conversation privée en tête-à-tête avec Olivier.\n\n${await getOrgSnapshot()}\n\n${projectReality}\n\n${await getAgentMemory(active.id, [saved.id])}\n\n${PLAIN_LANGUAGE}\n\nRéponds comme un collègue de confiance : clair, synthétique, direct. Ne parle que de ce qui relève de ton rôle. Ne cite jamais un collègue qui n'existe pas dans le contexte ci-dessus, et ne prétends jamais qu'un travail est fait ou qu'un lien existe si l'état réel du projet ci-dessus ne le confirme pas. En français.`,
        history
      )
      const { data: savedReply } = await supabase
        .from('dm_messages')
        .insert({ agent_id: activeId, author_id: activeId, content: reply, project_id: linkedProjectId || null })
        .select()
        .single()
      setThreads(prev => ({ ...prev, [activeId]: [...(prev[activeId] || []), savedReply] }))
    } catch (e) {
      setThreads(prev => ({
        ...prev,
        [activeId]: [...(prev[activeId] || []), { id: 'err-' + Date.now(), author_id: 'system', content: `Erreur : ${e.message}` }],
      }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Liste des agents */}
      <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[color:var(--color-line)] px-4 py-4 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] px-2 mb-3">Messages privés</div>
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {ALL_AGENTS.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left shrink-0 transition-colors ${
                activeId === a.id ? 'bg-[color:var(--color-surface-2)]' : 'hover:bg-[color:var(--color-surface)]'
              }`}
            >
              <AgentAvatar agent={a} size="sm" />
              <div className="hidden md:block flex-1">
                <div className="text-sm flex items-center gap-1.5">
                  {a.name}
                  {hasUnread(threads[a.id], a.id) && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-gold)]" />}
                </div>
                <div className="text-[10px] text-[color:var(--color-mute)]">{a.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Fil de conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-[color:var(--color-line)] flex items-center gap-3">
          <AgentAvatar agent={active} />
          <div className="flex-1">
            <div className="font-display text-base">{active.name}</div>
            <div className="text-xs text-[color:var(--color-mute)]">{active.role}</div>
          </div>
          {linkedProjectId && (
            <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--color-gold)]" title="Ta prochaine réponse débloque les tâches en attente de ce projet">
              <PlayCircle size={13} /> Lié à un projet
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {currentThread.length === 0 && (
            <p className="text-sm text-[color:var(--color-mute)] text-center mt-10">
              Aucun message avec {active.name} pour l'instant.
            </p>
          )}
          {currentThread.map(m => (
            <DMBubble key={m.id} message={m} agent={active} onDelete={() => deleteMessage(m.id)} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-[color:var(--color-line)] flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={`Écrire à ${active.name}...`}
            className="flex-1 bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-4 py-2.5 text-sm placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="w-11 h-11 shrink-0 rounded-lg bg-[color:var(--color-gold)] flex items-center justify-center disabled:opacity-40"
          >
            <Send size={16} className="text-[color:var(--color-void)]" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DMBubble({ message, agent, onDelete }) {
  const isUser = message.author_id === 'user'
  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <AgentAvatar agent={agent} size="sm" />}
      <div className={`flex items-start gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          className={`max-w-[80%] md:max-w-[70%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
            isUser
              ? 'bg-[color:var(--color-gold)] text-[color:var(--color-void)]'
              : 'bg-[color:var(--color-surface)] border border-[color:var(--color-line)]'
          }`}
        >
          <div className="prose-msg">
            {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 shrink-0 mt-1 flex items-center justify-center text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]"
          title="Supprimer ce message"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
