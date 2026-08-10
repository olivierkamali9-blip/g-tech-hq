import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { isSupported, runProject } from '../lib/webcontainer'
import { PlayCircle, Loader2, ExternalLink } from 'lucide-react'

export default function CodeSandbox({ project }) {
  const [status, setStatus] = useState('idle') // idle | installing | running | ready | error
  const [logs, setLogs] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const logRef = useRef(null)

  function appendLog(chunk) {
    setLogs(prev => {
      const next = (prev + chunk).slice(-6000) // on garde les logs récents, pas la peine de tout stocker
      return next
    })
    setTimeout(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, 0)
  }

  async function start() {
    setStatus('installing')
    setLogs('')
    setPreviewUrl(null)
    try {
      const { data: files } = await supabase.from('project_files').select('path, content').eq('project_id', project.id)
      if (!files || files.length === 0) {
        appendLog("Aucun fichier dans ce projet pour l'instant.\n")
        setStatus('error')
        return
      }
      setStatus('running')
      await runProject(files, {
        onLog: appendLog,
        onServerReady: url => { setPreviewUrl(url); setStatus('ready') },
        onExit: (code, step) => {
          appendLog(`\n--- ${step} terminé avec le code ${code} ---\n`)
          if (code !== 0) setStatus('error')
          else if (!previewUrl) setStatus('ready')
        },
      })
    } catch (e) {
      appendLog(`Erreur : ${e.message}\n`)
      setStatus('error')
    }
  }

  if (!isSupported()) {
    return (
      <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
        <p className="text-xs text-[color:var(--color-mute)]">
          Ton navigateur ne prend pas en charge le test en direct (nécessite un navigateur récent type Chrome/Edge).
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">Tester dans le navigateur</span>
        <button
          onClick={start}
          disabled={status === 'installing' || status === 'running'}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-void)] font-medium disabled:opacity-50"
        >
          {status === 'installing' || status === 'running' ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
          {status === 'installing' ? 'Installation...' : status === 'running' ? 'Lancement...' : 'Lancer le test'}
        </button>
      </div>

      {logs && (
        <pre ref={logRef} className="bg-[color:var(--color-void)] border border-[color:var(--color-line)] rounded-lg p-3 text-[10px] font-mono text-[color:var(--color-ivory-dim)] max-h-40 overflow-y-auto whitespace-pre-wrap mb-3">
          {logs}
        </pre>
      )}

      {previewUrl && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[color:var(--color-good)]">✓ Ça tourne vraiment</span>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[color:var(--color-gold)] flex items-center gap-1 hover:underline">
              <ExternalLink size={11} /> Ouvrir en plein écran
            </a>
          </div>
          <iframe src={previewUrl} className="w-full h-64 rounded-lg border border-[color:var(--color-line)] bg-white" title="Aperçu live" />
        </div>
      )}
    </div>
  )
}
