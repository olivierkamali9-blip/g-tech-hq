import { useState, useRef } from 'react'
import { WebContainer } from '@webcontainer/api'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot, getProjectReality, QUALITY_STANDARD } from '../lib/context'
import { extractFilesFromMessage, stripFileBlocks } from '../lib/codeParser'
import { Play, Loader2, TerminalSquare, RefreshCw } from 'lucide-react'

let containerInstance = null // une seule instance WebContainer à la fois dans l'onglet, réutilisée

async function getContainer() {
  if (!containerInstance) containerInstance = await WebContainer.boot()
  return containerInstance
}

function toFileTree(files) {
  const tree = {}
  for (const f of files) {
    const parts = f.path.split('/')
    let node = tree
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]].directory || (node[parts[i]] = { directory: {} }).directory
      node = node[parts[i]]
    }
    node[parts[parts.length - 1]] = { file: { contents: f.content } }
  }
  return tree
}

export default function Sandbox({ project, agent }) {
  const [status, setStatus] = useState('idle') // idle | booting | installing | running | error | fixed
  const [log, setLog] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const logRef = useRef(null)

  function appendLog(chunk) {
    setLog(prev => (prev + chunk).slice(-6000))
    requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight })
  }

  async function runOnce(attempt = 1) {
    setStatus('booting')
    setPreviewUrl(null)
    appendLog(`\n--- Tentative ${attempt} ---\n`)

    const { data: files } = await supabase.from('project_files').select('path, content').eq('project_id', project.id)
    if (!files || files.length === 0) {
      appendLog('Aucun fichier à tester pour l\'instant.\n')
      setStatus('idle')
      return
    }
    const hasPackageJson = files.some(f => f.path === 'package.json')
    if (!hasPackageJson) {
      appendLog('Pas de package.json — ce projet n\'est pas encore une vraie application testable.\n')
      setStatus('error')
      return
    }

    const container = await getContainer()
    await container.mount(toFileTree(files))

    setStatus('installing')
    appendLog('$ npm install\n')
    const install = await container.spawn('npm', ['install'])
    install.output.pipeTo(new WritableStream({ write: chunk => appendLog(chunk) }))
    const installCode = await install.exit
    if (installCode !== 0) {
      appendLog(`\n❌ npm install a échoué (code ${installCode})\n`)
      await tryAutoFix(files, log)
      return
    }

    setStatus('running')
    appendLog('\n$ npm run dev\n')
    const dev = await container.spawn('npm', ['run', 'dev'])
    dev.output.pipeTo(new WritableStream({ write: chunk => appendLog(chunk) }))

    container.on('server-ready', (port, url) => {
      appendLog(`\n✅ Serveur prêt : ${url}\n`)
      setPreviewUrl(url)
      setStatus('running')
    })

    // Si rien ne démarre après un moment, on considère que ça a probablement échoué silencieusement
    setTimeout(() => {
      setStatus(s => {
        if (s === 'running' && !previewUrl) {
          tryAutoFix(files, log)
          return 'error'
        }
        return s
      })
    }, 25000)
  }

  async function tryAutoFix(files, currentLog) {
    if (!agent) {
      setStatus('error')
      return
    }
    appendLog('\n🔧 Échec détecté — je demande à l\'agent de corriger...\n')
    try {
      const [orgContext, projectReality] = await Promise.all([
        getOrgSnapshot(),
        getProjectReality(project.id, agent.id),
      ])
      const fix = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ.\n\n${orgContext}\n\n${projectReality}\n\nLe code du projet "${project.name}" vient d'échouer réellement au test dans un vrai environnement Node (WebContainer). Voici les dernières lignes de log d'erreur :\n${currentLog.slice(-2000)}\n\nCorrige le ou les fichiers responsables. ${QUALITY_STANDARD} Utilise EXACTEMENT ce format pour chaque fichier corrigé :\nFICHIER: chemin/fichier.ext\n\`\`\`langage\ncontenu complet corrigé\n\`\`\`\nNe recopie jamais le code hors de ce format.`,
        [{ role: 'user', content: 'Corrige cette erreur maintenant.' }]
      )
      const fixedFiles = extractFilesFromMessage(fix)
      if (fixedFiles.length === 0) {
        appendLog('L\'agent n\'a pas proposé de correction exploitable.\n')
        setStatus('error')
        return
      }
      for (const f of fixedFiles) {
        await supabase.from('project_files').upsert({ project_id: project.id, path: f.path, content: f.content, agent_id: agent.id }, { onConflict: 'project_id,path' })
      }
      await supabase.from('messages').insert({
        project_id: project.id, author_id: agent.id, author_name: agent.name,
        content: stripFileBlocks(fix.split(/BESOIN_OLIVIER:/i)[0]) || `J'ai corrigé ${fixedFiles.length} fichier(s) suite à un échec de test réel.`,
      })
      await supabase.from('activity_log').insert({ project_id: project.id, label: `${agent.name} a corrigé ${fixedFiles.length} fichier(s) après un test réel échoué` })
      appendLog(`${fixedFiles.length} fichier(s) corrigé(s), nouvel essai...\n`)
      setStatus('fixed')
      setTimeout(() => runOnce(2), 800)
    } catch (e) {
      appendLog(`Erreur pendant la correction : ${e.message}\n`)
      setStatus('error')
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-[color:var(--color-line)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">
          <TerminalSquare size={13} /> Bac à sable — test réel
        </div>
        <button
          onClick={() => runOnce(1)}
          disabled={status === 'booting' || status === 'installing' || status === 'running'}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-[color:var(--color-gold-dim)] text-[color:var(--color-gold-bright)] hover:bg-[color:var(--color-gold)]/10 disabled:opacity-50"
        >
          {['booting', 'installing'].includes(status) ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Tester maintenant
        </button>
      </div>

      {log && (
        <pre ref={logRef} className="bg-black/40 border border-[color:var(--color-line)] rounded-lg p-3 text-[10px] font-mono text-[color:var(--color-ivory-dim)] max-h-48 overflow-y-auto whitespace-pre-wrap mb-2">
          {log}
        </pre>
      )}

      {previewUrl && (
        <div className="border border-[color:var(--color-line)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1.5 bg-[color:var(--color-surface)] text-[10px] text-[color:var(--color-mute)]">
            <span>Aperçu en direct</span>
            <button onClick={() => runOnce(1)} className="hover:text-[color:var(--color-gold)]"><RefreshCw size={11} /></button>
          </div>
          <iframe src={previewUrl} title="Aperçu" className="w-full h-64 bg-white" />
        </div>
      )}

      <p className="text-[10px] text-[color:var(--color-mute)] mt-2">
        Fonctionne seulement pendant que cette page est ouverte — ce n'est pas encore relié à l'exécution automatique en arrière-plan.
      </p>
    </div>
  )
}
