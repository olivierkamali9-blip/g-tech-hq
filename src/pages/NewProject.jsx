import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { readFileAsText, READABLE_EXT } from '../lib/files'
import { LEADERSHIP } from '../data/agents'
import { Sparkles, Paperclip, X } from 'lucide-react'

const MANAGER = LEADERSHIP.find(a => a.id === 'manager')

export default function NewProject() {
  const [idea, setIdea] = useState('')
  const [attachment, setAttachment] = useState(null) // { name, content }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isReadable = READABLE_EXT.some(ext => file.name.toLowerCase().endsWith(ext))
    if (!isReadable) {
      setError('Format non pris en charge pour l\'instant — utilise .txt, .md, .csv ou .json.')
      return
    }
    const content = await readFileAsText(file)
    setAttachment({ name: file.name, content })
    setError(null)
    e.target.value = ''
  }

  async function submit() {
    if (!idea.trim()) return
    setLoading(true)
    setError(null)
    try {
      const name = idea.trim().slice(0, 60)
      const fullContent = attachment
        ? `${idea.trim()}\n\n📎 Document joint : ${attachment.name}\n---\n${attachment.content}`
        : idea.trim()

      const { data: project, error: pErr } = await supabase
        .from('projects')
        .insert({ name, description: idea.trim(), status: 'en_discussion' })
        .select()
        .single()
      if (pErr) throw pErr

      await supabase.from('messages').insert({
        project_id: project.id,
        author_id: 'user',
        author_name: 'Olivier',
        content: fullContent,
      })

      const managerReply = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ, l'espace de travail multi-agents d'Olivier. Un nouveau projet vient d'être proposé (éventuellement avec un document joint dont le contenu est inclus). Ton rôle : accueillir l'idée, poser 2-3 questions de clarification précises pour bien cadrer le projet, et proposer un premier avis sur sa faisabilité technique. Réponds comme un collègue de confiance : clair, synthétique, direct, sans blabla. Utilise le markdown seulement si ça aide vraiment. En français.`,
        [{ role: 'user', content: fullContent }]
      )

      await supabase.from('messages').insert({
        project_id: project.id,
        author_id: 'manager',
        author_name: MANAGER.name,
        content: managerReply,
      })

      await supabase.from('activity_log').insert({
        project_id: project.id,
        label: `Nouveau projet proposé : « ${name} »`,
      })

      navigate(`/projets/${project.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Nouveau projet</div>
      <h1 className="font-display text-3xl mb-3">Décris ce que tu as en tête</h1>
      <p className="text-[color:var(--color-ivory-dim)] text-sm mb-8">
        Écris librement, comme tu le ferais ici. Joins un document si ça aide à cadrer l'idée. Le Manager et l'équipe concernée réagissent, posent des questions, et challengent l'idée avant de la valider.
      </p>

      <textarea
        value={idea}
        onChange={e => setIdea(e.target.value)}
        placeholder="Ex : Je veux une application qui..."
        rows={8}
        className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg p-4 text-sm placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none resize-none"
      />

      {attachment && (
        <div className="mt-3 flex items-center gap-2 text-xs bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-3 py-2 w-fit">
          <Paperclip size={13} className="text-[color:var(--color-gold)]" />
          <span>{attachment.name}</span>
          <button onClick={() => setAttachment(null)} className="text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]">
            <X size={13} />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[color:var(--color-danger)] mt-3">{error}</p>}

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={submit}
          disabled={loading || !idea.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-void)] text-sm font-medium hover:bg-[color:var(--color-gold-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={16} />
          {loading ? 'Le Manager réfléchit...' : "Soumettre à l'équipe"}
        </button>

        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[color:var(--color-line)] text-sm cursor-pointer hover:border-[color:var(--color-gold-dim)] transition-colors">
          <Paperclip size={15} />
          Joindre un document
          <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFile} className="hidden" />
        </label>
      </div>
    </div>
  )
}
