import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FolderKanban } from 'lucide-react'

const STATUS_LABEL = {
  idee: 'Idée',
  en_discussion: 'En discussion',
  valide: 'Validé',
  en_cours: 'En cours',
  livre: 'Livré',
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProjects(data || [])
      setLoading(false)
    })
  }, [])

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
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-[color:var(--color-line)] text-[color:var(--color-ivory-dim)]">
                {STATUS_LABEL[p.status] || p.status}
              </span>
            </div>
            <p className="text-xs text-[color:var(--color-mute)] line-clamp-2">{p.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
