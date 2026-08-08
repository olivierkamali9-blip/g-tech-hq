import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react'

const KIND_LABEL = { deadline: 'Deadline', reunion: 'Réunion', livraison: 'Livraison', autre: 'Autre' }
const KIND_COLOR = {
  deadline: 'var(--color-danger)',
  reunion: 'var(--color-gold)',
  livraison: 'var(--color-good)',
  autre: 'var(--color-mute)',
}

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [kind, setKind] = useState('deadline')

  async function load() {
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('org_events').select('*').order('event_date', { ascending: true }),
      supabase.from('projects').select('id, name'),
    ])
    setEvents(e || [])
    setProjects(p || [])
  }

  useEffect(() => { load() }, [])

  async function addEvent() {
    if (!title.trim() || !date) return
    await supabase.from('org_events').insert({ title: title.trim(), event_date: date, kind })
    setTitle(''); setDate(''); setKind('deadline'); setAdding(false)
    load()
  }

  async function deleteEvent(id) {
    await supabase.from('org_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.event_date >= today)
  const past = events.filter(e => e.event_date < today)

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-gold)] mb-2">Calendrier</div>
          <h1 className="font-display text-3xl">L'organisation dans le temps</h1>
        </div>
        <button onClick={() => setAdding(v => !v)} className="w-9 h-9 rounded-full border border-[color:var(--color-line)] flex items-center justify-center hover:border-[color:var(--color-gold-dim)]">
          <Plus size={16} />
        </button>
      </div>

      {adding && (
        <div className="mb-8 p-4 border border-[color:var(--color-line)] rounded-lg space-y-2">
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Titre de l'évènement"
            className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none"
            />
            <select value={kind} onChange={e => setKind(e.target.value)} className="bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-sm outline-none">
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <button onClick={addEvent} className="text-xs px-3 py-2 rounded-md bg-[color:var(--color-gold)] text-[color:var(--color-void)]">Ajouter</button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="border border-dashed border-[color:var(--color-line)] rounded-lg p-12 text-center">
          <CalendarIcon size={28} className="mx-auto mb-3 text-[color:var(--color-mute)]" />
          <p className="text-sm text-[color:var(--color-ivory-dim)]">Rien de prévu pour l'instant.</p>
        </div>
      ) : (
        <>
          <h2 className="font-display text-lg mb-3">À venir</h2>
          {upcoming.length === 0 ? <p className="text-xs text-[color:var(--color-mute)] mb-8">Rien de prévu.</p> : (
            <div className="space-y-2 mb-10">
              {upcoming.map(e => <EventRow key={e.id} event={e} projects={projects} onDelete={deleteEvent} />)}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="font-display text-lg mb-3 text-[color:var(--color-mute)]">Passé</h2>
              <div className="space-y-2 opacity-50">
                {past.map(e => <EventRow key={e.id} event={e} projects={projects} onDelete={deleteEvent} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function EventRow({ event, projects, onDelete }) {
  const project = projects.find(p => p.id === event.project_id)
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-[color:var(--color-line)] group">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: KIND_COLOR[event.kind] }} />
        <div>
          <div className="text-sm">{event.title}</div>
          <div className="text-[11px] text-[color:var(--color-mute)]">
            {new Date(event.event_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {project ? ` — ${project.name}` : ''} · {KIND_LABEL[event.kind]}
          </div>
        </div>
      </div>
      <button onClick={() => onDelete(event.id)} className="opacity-0 group-hover:opacity-100 text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]">
        <Trash2 size={13} />
      </button>
    </div>
  )
}
