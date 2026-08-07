import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FileCode, Plus, Trash2, GitBranch, Loader2, ExternalLink } from 'lucide-react'

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || 'projet'
}

export default function ProjectFiles({ project, onProjectUpdate }) {
  const [files, setFiles] = useState([])
  const [adding, setAdding] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newContent, setNewContent] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  useEffect(() => {
    supabase.from('project_files').select('*').eq('project_id', project.id).order('path').then(({ data }) => {
      setFiles(data || [])
    })
  }, [project.id])

  async function addFile() {
    if (!newPath.trim() || !newContent.trim()) return
    const { data, error } = await supabase
      .from('project_files')
      .upsert({ project_id: project.id, path: newPath.trim(), content: newContent }, { onConflict: 'project_id,path' })
      .select()
      .single()
    if (!error) {
      setFiles(prev => [...prev.filter(f => f.path !== data.path), data].sort((a, b) => a.path.localeCompare(b.path)))
      setNewPath('')
      setNewContent('')
      setAdding(false)
    }
  }

  async function deleteFile(id) {
    await supabase.from('project_files').delete().eq('id', id)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  async function publish() {
    if (files.length === 0) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const repoName = project.github_repo || slugify(project.name)
      const res = await fetch('/api/github/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName,
          description: project.description,
          files: files.map(f => ({ path: f.path, content: f.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publication échouée')

      const { data: updated } = await supabase
        .from('projects')
        .update({ github_repo: repoName })
        .eq('id', project.id)
        .select()
        .single()
      onProjectUpdate(updated)

      await supabase.from('activity_log').insert({
        project_id: project.id,
        label: `Fichiers publiés sur GitHub : ${data.repoUrl}`,
      })

      setPublishResult({ ok: true, repoUrl: data.repoUrl })
    } catch (e) {
      setPublishResult({ ok: false, error: e.message })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">
          <FileCode size={13} /> Fichiers du projet
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
          <Plus size={15} />
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 border border-[color:var(--color-line)] rounded-lg p-3">
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            placeholder="ex : src/App.jsx"
            className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-2.5 py-1.5 text-xs outline-none"
          />
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Contenu du fichier..."
            rows={5}
            className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-2.5 py-1.5 text-xs outline-none font-mono resize-none"
          />
          <button onClick={addFile} className="text-xs px-3 py-1.5 rounded-md bg-[color:var(--color-gold)] text-[color:var(--color-void)]">
            Ajouter
          </button>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-xs text-[color:var(--color-mute)]">Aucun fichier pour l'instant.</p>
      ) : (
        <div className="space-y-1 mb-3">
          {files.map(f => (
            <div key={f.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md hover:bg-[color:var(--color-surface)] group">
              <span className="font-mono text-[color:var(--color-ivory-dim)]">{f.path}</span>
              <button onClick={() => deleteFile(f.id)} className="opacity-0 group-hover:opacity-100 text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={publish}
          disabled={publishing}
          className="w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-gold-dim)] text-[color:var(--color-gold-bright)] hover:bg-[color:var(--color-gold)]/10 disabled:opacity-50"
        >
          {publishing ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
          {publishing ? 'Publication en cours...' : project.github_repo ? 'Mettre à jour sur GitHub' : 'Publier sur GitHub'}
        </button>
      )}

      {publishResult?.ok && (
        <a
          href={publishResult.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--color-good)] hover:underline"
        >
          <ExternalLink size={12} /> Voir le repo sur GitHub
        </a>
      )}
      {publishResult && !publishResult.ok && (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">{publishResult.error}</p>
      )}
    </div>
  )
}
