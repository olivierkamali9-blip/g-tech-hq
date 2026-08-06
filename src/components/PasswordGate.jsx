import { useState, useEffect } from 'react'

const STORAGE_KEY = 'gtech-hq-auth'

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'ok') setUnlocked(true)
    setChecked(true)
  }, [])

  function submit(e) {
    e.preventDefault()
    if (input === import.meta.env.VITE_APP_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'ok')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  if (!checked) return null

  if (unlocked) return children

  return (
    <div className="h-screen flex items-center justify-center bg-[color:var(--color-void)] text-[color:var(--color-ivory)] px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full border border-[color:var(--color-gold)] flex items-center justify-center mb-4">
            <span className="font-display text-2xl text-[color:var(--color-gold-bright)]">G</span>
          </div>
          <h1 className="font-display text-2xl">G-Tech HQ</h1>
          <p className="text-xs text-[color:var(--color-mute)] mt-1">Bureau privé — accès restreint</p>
        </div>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={e => { setInput(e.target.value); setError(false) }}
          placeholder="Mot de passe"
          className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-4 py-3 text-sm text-center tracking-wide placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none"
        />
        {error && <p className="text-xs text-[color:var(--color-danger)] text-center mt-2">Mot de passe incorrect</p>}
        <button
          type="submit"
          className="w-full mt-4 py-3 rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-void)] text-sm font-medium hover:bg-[color:var(--color-gold-bright)] transition-colors"
        >
          Entrer
        </button>
      </form>
    </div>
  )
}
