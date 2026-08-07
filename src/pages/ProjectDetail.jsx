import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { ALL_AGENTS, LEADERSHIP } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import ReactMarkdown from 'react-markdown'
import { Send, Eye } from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [respondent, setRespondent] = useState('manager')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('projects').select('*').eq('id', id).single()
      const { data: m } = await supabase.from('messages').select('*').eq('project_id', id).order('created_at', { ascending: true })
      setProject(p)
      setMessages(m || [])
    }
    load()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim()) return
    setSending(true)
    const text = input.trim()
    setInput('')

    const userMsg = { project_id: id, author_id: 'user', author_name: 'Olivier', content: text }
    const { data: saved } = await supabase.from('messages').insert(userMsg).select().single()
    setMessages(prev => [...prev, saved])

    try {
      const agent = ALL_AGENTS.find(a => a.id === respondent)
      const history = [...messages, saved].map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ, l'espace de travail multi-agents d'Olivier. Ton rôle : ${agent.title}. Le projet en cours s'appelle "${project?.name}". Réponds comme un collègue de confiance et compétent : clair, synthétique, jamais de blabla ni de formules creuses, va droit au but tout en restant pertinent. Utilise le markdown seulement quand ça aide vraiment (liste courte, gras ponctuel), pas systématiquement. En français.`,
        history
      )
      const agentMsg = { project_id: id, author_id: agent.id, author_name: agent.name, content: reply }
      const { data: savedReply } = await supabase.from('messages').insert(agentMsg).select().single()
      setMessages(prev => [...prev, savedReply])
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), author_id: 'system', author_name: 'Système', content: `Erreur : ${e.message}` }])
    } finally {
      setSending(false)
    }
  }

  if (!project) return <div className="p-10 text-sm text-[color:var(--color-mute)]">Chargement...</div>

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 md:border-r border-[color:var(--color-line)]">
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-[color:var(--color-line)]">
          <h1 className="font-display text-xl">{project.name}</h1>
          <p className="text-xs text-[color:var(--color-mute)] mt-1 capitalize">{project.status.replace('_', ' ')}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-5">
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-[color:var(--color-line)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[color:var(--color-mute)]">Répond :</span>
            <select
              value={respondent}
              onChange={e => setRespondent(e.target.value)}
              className="bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md text-xs px-2 py-1"
            >
              {LEADERSHIP.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Écris à l'équipe..."
              className="flex-1 bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-4 py-2.5 text-sm placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="w-11 h-11 rounded-lg bg-[color:var(--color-gold)] flex items-center justify-center disabled:opacity-40"
            >
              <Send size={16} className="text-[color:var(--color-void)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Aperçu */}
      <div className="hidden md:block w-80 shrink-0 px-6 py-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-4">
          <Eye size={13} /> Aperçu du projet
        </div>
        <div className="border border-dashed border-[color:var(--color-line)] rounded-lg h-48 flex items-center justify-center text-xs text-[color:var(--color-mute)] text-center px-4">
          L'aperçu apparaîtra ici dès que l'équipe produit un livrable.
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.author_id === 'user'
  const agent = ALL_AGENTS.find(a => a.id === message.author_id)

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && agent && <AgentAvatar agent={agent} size="sm" />}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : ''} flex flex-col`}>
        {!isUser && (
          <span className="text-[11px] text-[color:var(--color-gold)] mb-1 font-medium">{message.author_name}</span>
        )}
        <div
          className={`px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
            isUser
              ? 'bg-[color:var(--color-gold)] text-[color:var(--color-void)]'
              : 'bg-[color:var(--color-surface)] border border-[color:var(--color-line)] text-[color:var(--color-ivory)]'
          }`}
        >
          <div className="prose-msg">
            {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
          </div>
        </div>
      </div>
    </div>
  )
}
