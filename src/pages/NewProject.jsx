import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { LEADERSHIP } from '../data/agents'
import { Sparkles } from 'lucide-react'

const MANAGER = LEADERSHIP.find(a => a.id === 'manager')

export default function NewProject() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit() {
    if (!idea.trim()) return
    setLoading(true)
    setError(null)
    try {
      // 1. Nom provisoire à partir de l'idée
      const name = idea.trim().slice(0, 60)

      // 2. Créer le projet
      const { data: project, error: pErr } = await supabase
        .from('projects')
        .insert({ name, description: idea.trim(), status: 'en_discussion' })
        .select()
        .single()
      if (pErr) throw pErr

      // 3. Enregistrer le message initial d'Olivier
      await supabase.from('messages').insert({
        project_id: project.id,
        author_id: 'user',
        author_name: 'Olivier',
        content: idea.trim(),
      })

      // 4. Le Manager réagit à l'idée
      const managerReply = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ, l'espace de travail multi-agents d'Olivier. Un nouveau projet vient d'être proposé. Ton rôle : accueillir l'idée, poser 2-3 questions de clarification précises pour bien cadrer le projet, et proposer un premier avis sur sa faisabilité technique. Réponds comme un collègue de confiance : clair, synthétique, direct, sans blabla. Utilise le markdown seulement si ça aide vraiment. En français.`,
        [{ role: 'user', content: idea.trim() }]
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
        Écris librement, comme tu le ferais ici. Le Manager et l'équipe concernée réagissent, posent des questions, et challengent l'idée avant de la valider.
      </p>

      <textarea
        value={idea}
        onChange={e => setIdea(e.target.value)}
        placeholder="Ex : Je veux une application qui..."
        rows={8}
        className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg p-4 text-sm placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none resize-none"
      />

      {error && <p className="text-sm text-[color:var(--color-danger)] mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || !idea.trim()}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-void)] text-sm font-medium hover:bg-[color:var(--color-gold-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles size={16} />
        {loading ? 'Le Manager réfléchit...' : "Soumettre à l'équipe"}
      </button>
    </div>
  )
}
