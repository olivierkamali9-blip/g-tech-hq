import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FileCode2 } from 'lucide-react'

export default function LivePreview({ projectId }) {
  const [files, setFiles] = useState(null)

  useEffect(() => {
    supabase.from('project_files').select('path, updated_at').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(5)
      .then(({ data }) => setFiles(data || []))
  }, [projectId])

  if (files === null) return <p className="text-[color:var(--color-mute)]">Chargement...</p>

  if (files.length === 0) {
    return <p className="text-[color:var(--color-mute)] text-center py-8">L'aperçu apparaîtra ici dès que l'équipe produit un livrable.</p>
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-mute)] mb-2">Derniers fichiers produits</p>
      <div className="space-y-1.5">
        {files.map(f => (
          <div key={f.path} className="flex items-center gap-2 text-[color:var(--color-ivory-dim)]">
            <FileCode2 size={12} className="text-[color:var(--color-gold)] shrink-0" />
            <span className="font-mono truncate">{f.path}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
