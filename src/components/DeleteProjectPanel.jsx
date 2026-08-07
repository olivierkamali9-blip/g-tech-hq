import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { LEADERSHIP } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import { Trash2, ShieldAlert } from 'lucide-react'

const SIMPLE_STATUSES = ['idee', 'en_discussion']

export default function DeleteProjectPanel({ project, onProjectUpdate }) {
  const [confirmSimple, setConfirmSimple] = useState(false)
  const [asking, setAsking] = useState(false)
  const navigate = useNavigate()
  const votes = project.deletion_votes || {}
  const isSimple = SIMPLE_STATUSES.includes(project.status)
  const allApproved = LEADERSHIP.every(a => votes[a.id] === 'approuve')
  const someRefused = LEADERSHIP.some(a => votes[a.id] === 'refuse')

  async function deleteProject() {
    await supabase.from('projects').delete().eq('id', project.id)
    navigate('/projets')
  }

  async function requestApproval() {
    setAsking(true)
    const newVotes = { ...votes }
    for (const agent of LEADERSHIP) {
      if (newVotes[agent.id]) continue // déjà voté
      try {
        const verdict = await askAgent(
          agent.engine,
          `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ. Olivier veut supprimer définitivement le projet "${project.name}" (statut actuel : ${project.status}). En tant que membre de la direction, donne ton avis honnête sur cette suppression selon ta fonction (${agent.title}). Commence ta réponse par exactement "APPROUVÉ" ou "REFUSÉ" en majuscules suivi de deux points, puis explique en 1-2 phrases courtes. Sois direct, sans blabla.`,
          [{ role: 'user', content: `Je veux supprimer le projet "${project.name}". Description : ${project.description}` }]
        )
        const isApproved = verdict.trim().toUpperCase().startsWith('APPROUVÉ')
        newVotes[agent.id] = isApproved ? 'approuve' : 'refuse'

        await supabase.from('messages').insert({
          project_id: project.id,
          author_id: agent.id,
          author_name: agent.name,
          content: verdict,
        })
      } catch (e) {
        // en cas d'erreur moteur, on ne bloque pas le processus indéfiniment
      }
    }
    const { data: updated } = await supabase
      .from('projects')
      .update({ deletion_votes: newVotes })
      .eq('id', project.id)
      .select()
      .single()
    onProjectUpdate(updated)
    setAsking(false)
  }

  function resetVotes() {
    supabase.from('projects').update({ deletion_votes: {} }).eq('id', project.id).then(({ data }) => {})
    onProjectUpdate({ ...project, deletion_votes: {} })
  }

  return (
    <div className="mt-10 border border-[color:var(--color-danger)]/30 rounded-lg p-5 bg-[color:var(--color-danger)]/[0.04]">
      <div className="flex items-center gap-2 text-sm text-[color:var(--color-danger)] mb-3">
        <ShieldAlert size={16} />
        <span className="font-medium">Zone sensible</span>
      </div>

      {isSimple ? (
        <>
          <p className="text-xs text-[color:var(--color-ivory-dim)] mb-3">
            Ce projet est encore en discussion — suppression directe possible.
          </p>
          {!confirmSimple ? (
            <button
              onClick={() => setConfirmSimple(true)}
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10"
            >
              <Trash2 size={13} /> Supprimer ce projet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs">Confirmer la suppression définitive ?</span>
              <button onClick={deleteProject} className="text-xs px-3 py-1.5 rounded-md bg-[color:var(--color-danger)] text-white">Oui, supprimer</button>
              <button onClick={() => setConfirmSimple(false)} className="text-xs px-3 py-1.5 rounded-md border border-[color:var(--color-line)]">Annuler</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-[color:var(--color-ivory-dim)] mb-4">
            Ce projet est avancé — la direction doit valider la suppression avant que tu puisses confirmer.
          </p>

          <div className="flex gap-4 mb-4">
            {LEADERSHIP.map(a => (
              <div key={a.id} className="flex flex-col items-center gap-1.5">
                <AgentAvatar agent={a} size="sm" />
                <span className="text-[10px] text-[color:var(--color-mute)]">{a.name}</span>
                <span className={`text-[10px] font-medium ${
                  votes[a.id] === 'approuve' ? 'text-[color:var(--color-good)]' :
                  votes[a.id] === 'refuse' ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-mute)]'
                }`}>
                  {votes[a.id] === 'approuve' ? 'Approuvé' : votes[a.id] === 'refuse' ? 'Refusé' : 'En attente'}
                </span>
              </div>
            ))}
          </div>

          {!allApproved && !someRefused && (
            <button
              onClick={requestApproval}
              disabled={asking}
              className="text-xs px-3 py-2 rounded-lg border border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 disabled:opacity-50"
            >
              {asking ? "La direction délibère..." : "Demander l'avis de la direction"}
            </button>
          )}

          {someRefused && (
            <div className="text-xs text-[color:var(--color-ivory-dim)] space-y-2">
              <p>Au moins un membre de la direction s'oppose — regarde ses raisons dans le fil de discussion.</p>
              <button onClick={resetVotes} className="text-xs px-3 py-1.5 rounded-md border border-[color:var(--color-line)]">Réessayer</button>
            </div>
          )}

          {allApproved && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--color-good)]">Direction unanime — tu peux confirmer.</span>
              <button onClick={deleteProject} className="text-xs px-3 py-1.5 rounded-md bg-[color:var(--color-danger)] text-white">Confirmer la suppression</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
