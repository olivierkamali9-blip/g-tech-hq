import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot, getAgentMemory } from '../lib/context'
import { LEADERSHIP } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import ReactMarkdown from 'react-markdown'
import { Send, Users2, PlayCircle } from 'lucide-react'

const FINANCE_KEYWORDS = ['budget', 'coût', 'cout', 'prix', 'rentab', 'monétis', 'monetis', 'argent', 'revenu', 'client', 'vendre', 'payant']
const LEGAL_KEYWORDS = ['légal', 'legal', 'loi', 'contrat', 'rgpd', 'données personnelles', 'donnees personnelles', 'droit', 'licence', 'conformité', 'conformite']
const TECH_KEYWORDS = ['architecture', 'technique', 'stack', 'sécurité', 'securite', 'base de données', 'base de donnees', 'api', 'performance', 'code', 'infrastructure']
const PRODUCT_KEYWORDS = ['fonctionnalité', 'fonctionnalite', 'feature', 'utilisateur', 'ux', 'interface', 'design', 'produit', 'parcours', 'expérience', 'experience']
function detectConcernedAgent(text) {
  const lower = text.toLowerCase()
  if (LEGAL_KEYWORDS.some(k => lower.includes(k))) return 'legal'
  if (FINANCE_KEYWORDS.some(k => lower.includes(k))) return 'finance'
  if (TECH_KEYWORDS.some(k => lower.includes(k))) return 'cto'
  if (PRODUCT_KEYWORDS.some(k => lower.includes(k))) return 'cpo'
  return null
}

export default function Meeting() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [respondent, setRespondent] = useState('manager')
  const [sending, setSending] = useState(false)
  const [signal, setSignal] = useState(null)
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
      const history = [...messages, saved].slice(-20).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ. C'est l'espace Réunion — la discussion générale de l'organisation, pas liée à un projet précis. Les décisions prises ici orientent tout le reste.\n\n${await getOrgSnapshot()}\n\n${await getAgentMemory(agent.id, [saved.id])}\n\nRéponds comme un collègue de confiance : clair, synthétique, direct. Ne cite jamais un collègue qui n'existe pas dans le contexte ci-dessus. En français.`,
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

      const candidates = LEADERSHIP.filter(a => a.id !== agent.id)
      try {
        const candidateList = candidates.map(a => `${a.id} = ${a.name} (${a.role})`).join('\n')
        const verdict = await askAgent(
          agent.engine,
          `Voici les autres membres de la Direction :\n${candidateList}\n\nDernier échange :\nOlivier : ${text}\n${agent.name} : ${reply}\n\nUn de ces agents a-t-il vraiment quelque chose d'IMPORTANT à ajouter — un problème détecté dans son domaine, une suggestion concrète, ou une proposition à valider ? Ne signale pas pour un commentaire trivial. Réponds UNIQUEMENT l'id exact de l'agent concerné, ou NON.`,
          [{ role: 'user', content: 'Évalue maintenant, en un mot.' }]
        )
        const matchId = candidates.find(a => new RegExp(`\\b${a.id}\\b`, 'i').test(verdict))?.id
        setSignal(matchId ? candidates.find(a => a.id === matchId) : null)
      } catch (e) {
        setSignal(null)
      }
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
        {signal && (
          <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-[color:var(--color-gold)]/10 border border-[color:var(--color-gold-dim)] text-xs">
            <span>🖐 <strong>{signal.name}</strong> ({signal.role}) semble concerné par ce sujet</span>
            <button
              onClick={() => { setRespondent(signal.id); setSignal(null) }}
              className="px-2 py-1 rounded-md bg-[color:var(--color-gold)] text-[color:var(--color-void)] font-medium shrink-0"
            >
              Donner la parole
            </button>
          </div>
        )}
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
