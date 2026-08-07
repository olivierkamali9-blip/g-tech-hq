import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowUpRight, Activity } from 'lucide-react'
import EngineStatus from '../components/EngineStatus'

export default function Organisation() {
  const [projects, setProjects] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
      ])
      setProjects(p || [])
      setActivity(a || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Vue d'ensemble</div>
        <h1 className="font-display text-3xl">L'organisation, en un coup d'œil</h1>
        <p className="text-[color:var(--color-ivory-dim)] mt-2 text-sm">
          {projects.length === 0 && !loading
            ? "Aucun projet pour l'instant — crée le premier depuis « Nouveau projet »."
            : `${projects.length} projet(s) suivi(s) par l'équipe.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Projets actifs" value={projects.filter(p => p.status === 'en_cours').length} />
        <StatCard label="En discussion" value={projects.filter(p => p.status === 'en_discussion' || p.status === 'idee').length} />
        <StatCard label="Livrés" value={projects.filter(p => p.status === 'livre').length} />
      </div>

      <div className="mb-10">
        <EngineStatus />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="col-span-3">
          <h2 className="font-display text-lg mb-4">Projets récents</h2>
          {projects.length === 0 ? (
            <EmptyBox text="Rien à afficher pour le moment." />
          ) : (
            <div className="space-y-2">
              {projects.map(p => (
                <Link
                  key={p.id}
                  to={`/projets/${p.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-[color:var(--color-line)] hover:border-[color:var(--color-gold-dim)] transition-colors group"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-[color:var(--color-mute)] mt-0.5 capitalize">{p.status.replace('_', ' ')}</div>
                  </div>
                  <ArrowUpRight size={16} className="text-[color:var(--color-mute)] group-hover:text-[color:var(--color-gold)]" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2">
          <h2 className="font-display text-lg mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[color:var(--color-gold)]" />
            Fil d'activité
          </h2>
          {activity.length === 0 ? (
            <EmptyBox text="L'historique de l'équipe s'affichera ici." />
          ) : (
            <div className="space-y-4">
              {activity.map(a => (
                <div key={a.id} className="text-sm border-l border-[color:var(--color-line)] pl-4">
                  <div className="text-[color:var(--color-ivory-dim)]">{a.label}</div>
                  <div className="text-[11px] text-[color:var(--color-mute)] mt-0.5 font-mono">
                    {new Date(a.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="font-display text-3xl text-[color:var(--color-gold-bright)]">{value}</div>
      <div className="text-xs text-[color:var(--color-ivory-dim)] mt-1">{label}</div>
    </div>
  )
}

function EmptyBox({ text }) {
  return (
    <div className="border border-dashed border-[color:var(--color-line)] rounded-lg p-8 text-center text-sm text-[color:var(--color-mute)]">
      {text}
    </div>
  )
}
