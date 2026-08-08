import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { History } from 'lucide-react'

export default function ProjectJournal({ projectId }) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    supabase.from('activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setEntries(data || []))
  }, [projectId])

  if (entries.length === 0) return null

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-3">
        <History size={13} /> Avancement
      </div>
      <div className="space-y-2.5">
        {entries.map(e => (
          <div key={e.id} className="text-xs border-l border-[color:var(--color-line)] pl-3">
            <div className="text-[color:var(--color-ivory-dim)]">{e.label}</div>
            <div className="text-[10px] text-[color:var(--color-mute)] font-mono mt-0.5">
              {new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
