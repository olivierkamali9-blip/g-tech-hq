import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FolderKanban, Trash2 } from 'lucide-react'

const STATUS_LABEL = {
  idee: 'Idée',
  en_discussion: 'En discussion',
  valide: 'Validé',
  en_cours: 'En cours',
  livre: 'Livré',
}
const SIMPLE_STATUSES = ['idee', 'en_discussion']

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProjects(data || [])
      setLoading(false)
    })
  }, [])

  async function quickDelete(e, p) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Supprimer « ${p.name} » ? Cette action est définitive.`)) return
    await supabase.from('projects').delete().eq('id', p.id)
    setProjects(prev => prev.filter(x => x.id !== p.id))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Mes projets</div>
        <h1 className="font-display text-3xl">Tous tes projets</h1>
      </div>

      {!loading && projects.length === 0 && (
        <div className="border border-dashed border-[color:var(--color-line)] rounded-lg p-12 text-center">
          <FolderKanban size={28} className="mx-auto mb-3 text-[color:var(--color-mute)]" />
          <p className="text-sm text-[color:var(--color-ivory-dim)]">Aucun projet encore.</p>
          <Link to="/nouveau" className="text-sm text-[color:var(--color-gold)] hover:underline mt-2 inline-block">
            Proposer une idée →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map(p => (
          <Link
            key={p.id}
            to={`/projets/${p.id}`}
            className="p-5 rounded-lg border border-[color:var(--color-line)] hover:border-[color:var(--color-gold-dim)] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{p.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-[color:var(--color-line)] text-[color:var(--color-ivory-dim)]">
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                {SIMPLE_STATUSES.includes(p.status) && (
                  <button
                    onClick={e => quickDelete(e, p)}
                    className="w-6 h-6 flex items-center justify-center text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-[color:var(--color-mute)] line-clamp-2">{p.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
