import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Rocket, ExternalLink, Pencil, Check } from 'lucide-react'

const GITHUB_OWNER = 'olivierkamali9-blip'

export default function DeliveryPanel({ project, onProjectUpdate }) {
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState(project.vercel_url || '')

  if (!project.github_repo && !project.vercel_url) {
    return (
      <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-2">
          <Rocket size={13} /> Livraison
        </div>
        <p className="text-xs text-[color:var(--color-mute)]">
          Rien de publié encore. Ça apparaîtra ici dès qu'un agent écrit du code dans ce projet.
        </p>
      </div>
    )
  }

  async function saveUrl() {
    const { data } = await supabase.from('projects').update({ vercel_url: urlDraft.trim() || null }).eq('id', project.id).select().single()
    onProjectUpdate(data)
    setEditingUrl(false)
  }

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-3">
        <Rocket size={13} /> Livraison
      </div>

      {project.github_repo && (
        <a
          href={`https://github.com/${GITHUB_OWNER}/${project.github_repo}`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-[color:var(--color-ivory-dim)] hover:text-[color:var(--color-gold)] mb-2"
        >
          <ExternalLink size={12} /> Code source sur GitHub
        </a>
      )}

      {editingUrl ? (
        <div className="flex items-center gap-1.5">
          <input
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveUrl()}
            placeholder="https://mon-projet.vercel.app"
            className="flex-1 bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-2 py-1 text-xs outline-none"
            autoFocus
          />
          <button onClick={saveUrl} className="text-[color:var(--color-gold)]"><Check size={14} /></button>
        </div>
      ) : project.vercel_url ? (
        <div className="flex items-center gap-1.5 group">
          <a href={project.vercel_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[color:var(--color-good)] hover:underline">
            <ExternalLink size={12} /> Voir le produit en ligne
          </a>
          <button onClick={() => setEditingUrl(true)} className="opacity-0 group-hover:opacity-100 text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
            <Pencil size={11} />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditingUrl(true)} className="text-xs text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
          + Ajouter le lien du produit en ligne
        </button>
      )}
    </div>
  )
}
