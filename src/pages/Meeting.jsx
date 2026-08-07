import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { LEADERSHIP } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import ReactMarkdown from 'react-markdown'
import { Send, Users2 } from 'lucide-react'

export default function Meeting() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [respondent, setRespondent] = useState('manager')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase.from('messages').select('*').is('project_id', null).order('created_at', { ascending: true }).then(({ data }) => {
      setMessages(data || [])
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim()) return
    setSending(true)
    const text = input.trim()
    setInput('')

    const { data: saved } = await supabase.from('messages').insert({
      project_id: null, author_id: 'user', author_name: 'Olivier', content: text,
    }).select().single()
    setMessages(prev => [...prev, saved])

    try {
      const agent = LEADERSHIP.find(a => a.id === respondent)
      const history = [...messages, saved].map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ. C'est l'espace Réunion — la discussion générale de l'organisation, pas liée à un projet précis. Les décisions prises ici orientent tout le reste. Réponds comme un collègue de confiance : clair, synthétique, direct. En français.`,
        history
      )
      const { data: savedReply } = await supabase.from('messages').insert({
        project_id: null, author_id: agent.id, author_name: agent.name, content: reply,
      }).select().single()
      setMessages(prev => [...prev, savedReply])

      await supabase.from('activity_log').insert({
        project_id: null,
        label: `Réunion — ${agent.name} : ${reply.slice(0, 80)}${reply.length > 80 ? '…' : ''}`,
      })
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), author_id: 'system', author_name: 'Système', content: `Erreur : ${e.message}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto">
      <div className="px-4 md:px-8 py-4 md:py-5 border-b border-[color:var(--color-line)] flex items-center gap-2">
        <Users2 size={16} className="text-[color:var(--color-gold)]" />
        <div>
          <h1 className="font-display text-xl">Réunion</h1>
          <p className="text-xs text-[color:var(--color-mute)]">Espace permanent de la Direction — Adrien, Élise, Nadia</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-5">
        {messages.length === 0 && (
          <p className="text-sm text-[color:var(--color-mute)] text-center mt-10">
            Rien encore ici. C'est l'endroit pour parler de l'organisation dans son ensemble, pas d'un projet précis.
          </p>
        )}
        {messages.map(m => <MeetingBubble key={m.id} message={m} />)}
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
            placeholder="Parler à la Direction..."
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

function MeetingBubble({ message }) {
  const isUser = message.author_id === 'user'
  const agent = LEADERSHIP.find(a => a.id === message.author_id)
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && agent && <AgentAvatar agent={agent} size="sm" />}
      <div className={`max-w-[75%] flex flex-col ${isUser ? 'items-end' : ''}`}>
        {!isUser && <span className="text-[11px] text-[color:var(--color-gold)] mb-1 font-medium">{message.author_name}</span>}
        <div className={`px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
          isUser ? 'bg-[color:var(--color-gold)] text-[color:var(--color-void)]' : 'bg-[color:var(--color-surface)] border border-[color:var(--color-line)]'
        }`}>
          <div className="prose-msg">{isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}</div>
        </div>
      </div>
    </div>
  )
}
