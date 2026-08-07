import { useEffect, useState } from 'react'
import { ENGINE_LABEL } from '../data/agents'
import { RefreshCw } from 'lucide-react'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export default function EngineStatus() {
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  async function check() {
    setChecking(true)
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { check() }, [])

  const githubDays = status?.github ? daysUntil(status.github.expiresAt) : null

  return (
    <div className="p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.15em] text-[color:var(--color-mute)]">Statut des moteurs</span>
        <button onClick={check} disabled={checking} className="text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-1.5">
        {Object.entries(ENGINE_LABEL).map(([key, label]) => {
          const ok = status?.[key]
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--color-ivory-dim)]">{label}</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === null ? 'bg-[color:var(--color-mute)]' : ok ? 'bg-[color:var(--color-good)]' : 'bg-[color:var(--color-danger)]'
                  }`}
                />
                <span className="text-[color:var(--color-mute)]">
                  {status === null ? '...' : ok ? 'Disponible' : 'Indisponible'}
                </span>
              </span>
            </div>
          )
        })}

        <div className="pt-1.5 mt-1.5 border-t border-[color:var(--color-line)] flex items-center justify-between text-xs">
          <span className="text-[color:var(--color-ivory-dim)]">GitHub</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === null ? 'bg-[color:var(--color-mute)]' :
                status?.github?.ok ? (githubDays !== null && githubDays < 14 ? 'bg-[color:var(--color-warn)]' : 'bg-[color:var(--color-good)]') :
                'bg-[color:var(--color-danger)]'
              }`}
            />
            <span className="text-[color:var(--color-mute)]">
              {status === null ? '...' : !status?.github?.ok ? 'Indisponible' : githubDays !== null ? `Expire dans ${githubDays} j` : 'Connecté'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
