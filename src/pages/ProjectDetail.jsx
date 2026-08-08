import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot, getAgentMemory } from '../lib/context'
import { fetchDynamicAgents } from '../lib/dynamicAgents'
import { extractFilesFromMessage, stripFileBlocks } from '../lib/codeParser'
import { readFileAsText, downloadTextFile, READABLE_EXT, slugify } from '../lib/files'
import { ALL_AGENTS, LEADERSHIP, POOL } from '../data/agents'
import AgentAvatar from '../components/AgentAvatar'
import DeleteProjectPanel from '../components/DeleteProjectPanel'
import ProjectFiles from '../components/ProjectFiles'
import AssignTeamPanel from '../components/AssignTeamPanel'
import ProjectJournal from '../components/ProjectJournal'
import DeliveryPanel from '../components/DeliveryPanel'
import WorkPlanPanel from '../components/WorkPlanPanel'
import LivePreview from '../components/LivePreview'
import ReactMarkdown from 'react-markdown'
import { Send, Eye, Trash2, Paperclip, X, Download, Zap, Pencil, Check } from 'lucide-react'

const FINANCE_KEYWORDS = ['budget', 'coût', 'cout', 'prix', 'rentab', 'monétis', 'monetis', 'argent', 'revenu', 'client', 'vendre', 'payant']
const LEGAL_KEYWORDS = ['légal', 'legal', 'loi', 'contrat', 'rgpd', 'données personnelles', 'donnees personnelles', 'droit', 'licence', 'conformité', 'conformite']
const STATUSES = ['idee', 'en_discussion', 'valide', 'en_cours', 'livre']
const STATUS_LABEL = { idee: 'Idée', en_discussion: 'En discussion', valide: 'Validé', en_cours: 'En cours', livre: 'Livré' }

function detectConcernedAgent(text) {
  const lower = text.toLowerCase()
  if (LEGAL_KEYWORDS.some(k => lower.includes(k))) return 'legal'
  if (FINANCE_KEYWORDS.some(k => lower.includes(k))) return 'finance'
  return null
}

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [messages, setMessages] = useState([])
  const [projectAgents, setProjectAgents] = useState([]) // [{agent_id, role_in_project}]
  const [dynamicAgents, setDynamicAgents] = useState([])
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [respondent, setRespondent] = useState('manager')
  const [sending, setSending] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const bottomRef = useRef(null)

  async function loadAll() {
    const [{ data: p }, { data: m }, { data: pa }, dyn] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('project_id', id).order('created_at', { ascending: true }),
      supabase.from('project_agents').select('*').eq('project_id', id),
      fetchDynamicAgents(),
    ])
    setProject(p)
    setMessages(m || [])
    setProjectAgents(pa || [])
    setDynamicAgents(dyn)
    if (p) setNameDraft(p.name)
  }

  useEffect(() => { loadAll() }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const allKnown = [...ALL_AGENTS, ...dynamicAgents]

  function projectTeamText() {
    if (projectAgents.length === 0 && !project.lead_agent_id) {
      return "ÉQUIPE DE CE PROJET : personne n'est encore assigné à ce projet précis."
    }
    const leadAgent = allKnown.find(a => a.id === project.lead_agent_id)
    const members = projectAgents
      .filter(pa => pa.agent_id !== project.lead_agent_id)
      .map(pa => {
        const a = allKnown.find(x => x.id === pa.agent_id)
        if (!a) return null
        return `- ${a.name} (${a.role})${pa.role_in_project ? ` : ${pa.role_in_project}` : ''}`
      }).filter(Boolean)

    const leadLine = leadAgent
      ? `CHEF DE CE PROJET : ${leadAgent.name} (${leadAgent.role}). C'est lui qui planifie, répartit les tâches entre les membres ci-dessous, contrôle leur travail, sollicite les validations nécessaires (CTO/CPO/Finance/Juridique selon le sujet), puis transmet le résultat au Manager (Adrien). Les autres membres de cette équipe rendent compte à ${leadAgent.name} pour ce projet, pas directement à Adrien.`
      : "Aucun chef de projet désigné pour l'instant."

    return `ÉQUIPE ASSIGNÉE À CE PROJET PRÉCIS (les seuls agents censés y travailler activement) :\n${leadLine}\n${members.length ? 'MEMBRES SOUS SA SUPERVISION :\n' + members.join('\n') : ''}`
  }

  // Qui peut répondre : la Direction + les agents réellement assignés à ce projet
  const respondable = [
    ...LEADERSHIP,
    ...[...POOL, ...dynamicAgents].filter(a => projectAgents.some(pa => pa.agent_id === a.id)),
  ]

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isReadable = READABLE_EXT.some(ext => file.name.toLowerCase().endsWith(ext))
    if (!isReadable) return
    const content = await readFileAsText(file)
    setAttachment({ name: file.name, content })
    e.target.value = ''
  }

  async function saveName() {
    if (!nameDraft.trim()) return
    const { data } = await supabase.from('projects').update({ name: nameDraft.trim() }).eq('id', id).select().single()
    setProject(data)
    setEditingName(false)
  }

  async function changeStatus(newStatus) {
    const { data } = await supabase.from('projects').update({ status: newStatus }).eq('id', id).select().single()
    setProject(data)
    await supabase.from('activity_log').insert({ project_id: id, label: `Statut de « ${data.name} » changé en ${STATUS_LABEL[newStatus]}` })
    if (newStatus === 'en_cours') await generatePlan(data)
  }

  async function generatePlan(currentProject) {
    const MANAGER = LEADERSHIP.find(a => a.id === 'manager')
    try {
      const orgContext = await getOrgSnapshot()
      const raw = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\n${projectTeamText()}\n\nOlivier vient de lancer le travail sur "${currentProject.name}" (${currentProject.description}). Découpe ce projet en 4 à 10 tâches concrètes, actionnables, dans l'ordre logique d'exécution. La plupart sont assignées à un agent RÉELLEMENT assigné à ce projet (voir équipe ci-dessus — si personne n'est assigné, assigne-toi les tâches à toi-même). MAIS respecte aussi le vrai circuit de validation : insère une tâche de validation assignée au bon responsable de la Direction (cto pour l'architecture/technique, cpo pour les fonctionnalités/produit, finance si impact financier notable, legal si conformité/licence en jeu) À CHAQUE ÉTAPE où ça a du sens, juste après le travail concerné — pas systématiquement partout, seulement quand c'est pertinent. Réponds UNIQUEMENT avec ce format, une ligne par tâche, rien d'autre :\nTACHE: <id de l'agent> | <description courte et actionnable>`,
        [{ role: 'user', content: 'Découpe le projet en tâches maintenant.' }]
      )
      const lines = [...raw.matchAll(/TACHE:\s*([a-z0-9-]+)\s*\|\s*(.+)/gi)]
      const tasks = lines.map((m, i) => ({ project_id: id, agent_id: m[1].trim(), description: m[2].trim(), sequence: i }))
      if (tasks.length > 0) {
        await supabase.from('project_tasks').insert(tasks)
        await supabase.from('projects').update({ orchestration_paused: false }).eq('id', id)
        await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a établi un plan de ${tasks.length} tâches` })
      }
    } catch (e) {}
  }

  async function autoSaveAndPublish(files) {
    if (files.length === 0) return
    for (const f of files) {
      await supabase.from('project_files').upsert({ project_id: id, path: f.path, content: f.content }, { onConflict: 'project_id,path' })
    }
    const repoName = project.github_repo || slugify(project.name)
    try {
      const res = await fetch('/api/github/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, description: project.description, files }),
      })
      if (res.ok) {
        if (!project.github_repo) {
          const { data: updated } = await supabase.from('projects').update({ github_repo: repoName }).eq('id', id).select().single()
          setProject(updated)
        }
        await supabase.from('activity_log').insert({
          project_id: id, label: `${files.length} fichier${files.length > 1 ? 's' : ''} publié${files.length > 1 ? 's' : ''} automatiquement sur GitHub`,
        })
      }
    } catch (e) {}
  }

  async function send() {
    if (!input.trim() && !attachment) return
    setSending(true)
    const text = attachment
      ? `${input.trim()}\n\n📎 Document joint : ${attachment.name}\n---\n${attachment.content}`
      : input.trim()
    setInput('')
    setAttachment(null)

    const userMsg = { project_id: id, author_id: 'user', author_name: 'Olivier', content: text }
    const { data: saved } = await supabase.from('messages').insert(userMsg).select().single()
    setMessages(prev => [...prev, saved])

    try {
      const agent = allKnown.find(a => a.id === respondent)
      const history = [...messages, saved].slice(-20).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const [orgContext, agentMemory] = await Promise.all([getOrgSnapshot(), getAgentMemory(agent.id)])
      const reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ, l'espace de travail multi-agents d'Olivier. Ton rôle : ${agent.title}.\n\n${orgContext}\n\n${projectTeamText()}\n\n${agentMemory}\n\nLe projet en cours s'appelle "${project?.name}". Ne parle QUE de ce qui relève de ton rôle ; si une question dépasse ton domaine, dis que c'est à un autre membre de l'ÉQUIPE DE CE PROJET de répondre (nomme-le). Ne connais et ne cite jamais un collègue qui n'est pas listé dans le contexte ci-dessus — s'inventer un nom est une faute grave.\n\nSi tu écris du code, structure le projet PROFESSIONNELLEMENT comme un vrai projet tech (dossiers src/, un README.md, package.json si pertinent — jamais tout à plat). Utilise EXACTEMENT ce format pour chaque fichier :\nFICHIER: chemin/du/fichier.ext\n\`\`\`langage\ncontenu complet du fichier\n\`\`\`\nIMPORTANT : dans ta réponse visible (en dehors des blocs FICHIER), ne recopie JAMAIS le code ni son contenu — Olivier ne veut pas le voir défiler dans le chat, seulement sur GitHub. Dis juste en une phrase ce que tu as fait (ex: \"J'ai ajouté la structure de base avec 3 fichiers, disponible sur GitHub.\"). Tu n'es pas obligé d'utiliser Supabase/Vercel par défaut — propose la meilleure architecture selon le projet. Si une action nécessite qu'Olivier fasse quelque chose lui-même (créer un compte, coller du SQL, connecter le repo à Vercel pour le déploiement...), termine ta réponse par une ligne "BESOIN_OLIVIER:" suivie des étapes précises, numérotées, comme un tutoriel clair — ça lui sera envoyé en message privé automatiquement. Si Olivier te demande un document, rédige-le entièrement en markdown.`,
        history
      )
      const [visiblePart, needRaw] = reply.split(/BESOIN_OLIVIER:/i)
      const agentMsg = { project_id: id, author_id: agent.id, author_name: agent.name, content: stripFileBlocks(visiblePart.trim()) }
      const { data: savedReply } = await supabase.from('messages').insert(agentMsg).select().single()
      setMessages(prev => [...prev, savedReply])

      const files = extractFilesFromMessage(reply)
      if (files.length > 0) await autoSaveAndPublish(files)

      if (needRaw && needRaw.trim()) {
        await supabase.from('dm_messages').insert({
          agent_id: agent.id, author_id: agent.id,
          content: `À propos du projet **${project.name}** :\n\n${needRaw.trim()}`,
        })
      }

      const concernedId = detectConcernedAgent(text + ' ' + reply)
      if (concernedId && concernedId !== agent.id) {
        const concerned = LEADERSHIP.find(a => a.id === concernedId)
        try {
          const [chimeOrg, chimeMemory] = await Promise.all([getOrgSnapshot(), getAgentMemory(concerned.id)])
          const chimeIn = await askAgent(
            concerned.engine,
            `Tu es ${concerned.name}, "${concerned.role}" dans G-Tech HQ. ${chimeOrg}\n\n${projectTeamText()}\n\n${chimeMemory}\n\nTu n'as pas été sollicité directement, mais ce qui vient d'être dit dans le projet "${project?.name}" touche à ton domaine (${concerned.title}). Interviens brièvement seulement si tu as un point pertinent — reste concis. En français.`,
            [...history, { role: 'assistant', content: reply }]
          )
          const { data: savedChime } = await supabase.from('messages').insert({
            project_id: id, author_id: concerned.id, author_name: concerned.name, content: chimeIn,
          }).select().single()
          setMessages(prev => [...prev, savedChime])
        } catch (e) {}
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), author_id: 'system', author_name: 'Système', content: `Erreur : ${e.message}` }])
    } finally {
      setSending(false)
    }
  }

  async function advanceProject() {
    setAdvancing(true)
    const MANAGER = LEADERSHIP.find(a => a.id === 'manager')
    try {
      const history = messages.slice(-20).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const [orgContext, agentMemory] = await Promise.all([getOrgSnapshot(), getAgentMemory(MANAGER.id)])
      const decision = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\n${projectTeamText()}\n\n${agentMemory}\n\nLe projet "${project?.name}" est en cours. IMPORTANT : tu ne peux QUE toi-même agir maintenant (les autres agents de l'équipe ne travaillent pas en arrière-plan, ils n'agissent que quand Olivier leur écrit directement). Donc soit tu fais toi-même une action concrète MAINTENANT (écrire un fichier, une décision, un document), soit tu dis clairement à Olivier quel agent il doit aller solliciter et pourquoi — ne prétends jamais qu'un autre agent est "en train de" faire quelque chose s'il n'a pas été sollicité. Si tu écris du code, structure-le professionnellement et utilise EXACTEMENT ce format par fichier :\nFICHIER: chemin/du/fichier.ext\n\`\`\`langage\ncontenu complet\n\`\`\`\nNe recopie jamais le code dans ta réponse visible en dehors de ce format. SEULEMENT si une action nécessite absolument Olivier (compte à créer, SQL à coller...), termine par "BESOIN_OLIVIER:" suivi des étapes précises numérotées. Si une échéance concrète se dégage, ajoute une ligne "DEADLINE: <titre court> | <date AAAA-MM-JJ>". Sois concis, en français.`,
        [...history, { role: 'user', content: 'Fais avancer ce projet maintenant.' }]
      )

      const [publicPart, rest] = decision.split(/BESOIN_OLIVIER:/i)
      const needMatch = rest?.match(/^(.*?)(?:\n?DEADLINE:|$)/is)
      const needPart = needMatch ? needMatch[1] : rest
      const deadlineMatch = decision.match(/DEADLINE:\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})/i)

      const { data: savedReply } = await supabase.from('messages').insert({
        project_id: id, author_id: MANAGER.id, author_name: MANAGER.name, content: stripFileBlocks(publicPart.trim()),
      }).select().single()
      setMessages(prev => [...prev, savedReply])

      const files = extractFilesFromMessage(decision)
      if (files.length > 0) await autoSaveAndPublish(files)

      await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a fait avancer « ${project.name} »` })

      if (needPart && needPart.trim()) {
        await supabase.from('dm_messages').insert({
          agent_id: MANAGER.id, author_id: MANAGER.id,
          content: `À propos du projet **${project.name}** : ${needPart.trim()}`,
        })
      }

      if (deadlineMatch) {
        await supabase.from('org_events').insert({
          project_id: id, title: deadlineMatch[1].trim(), event_date: deadlineMatch[2], kind: 'deadline',
        })
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), author_id: 'system', author_name: 'Système', content: `Erreur : ${e.message}` }])
    } finally {
      setAdvancing(false)
    }
  }

  async function deleteMessage(messageId) {
    if (typeof messageId === 'string' && messageId.startsWith('err-')) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
      return
    }
    if (!confirm('Supprimer ce message ?')) return
    await supabase.from('messages').delete().eq('id', messageId)
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  if (!project) return <div className="p-10 text-sm text-[color:var(--color-mute)]">Chargement...</div>

  return (
    <div className="h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
      {/* Chat */}
      <div className="flex flex-col min-w-0 md:flex-1 md:border-r border-[color:var(--color-line)]">
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-[color:var(--color-line)]">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="font-display text-xl bg-[color:var(--color-surface)] border border-[color:var(--color-gold-dim)] rounded px-2 py-0.5 flex-1"
                autoFocus
              />
              <button onClick={saveName} className="text-[color:var(--color-gold)]"><Check size={18} /></button>
            </div>
          ) : (
            <h1 className="font-display text-xl flex items-center gap-2 group">
              {project.name}
              <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]">
                <Pencil size={13} />
              </button>
            </h1>
          )}
          <div className="flex items-center gap-2 mt-1">
            <select
              value={project.status}
              onChange={e => changeStatus(e.target.value)}
              className="text-xs text-[color:var(--color-mute)] bg-transparent outline-none cursor-pointer hover:text-[color:var(--color-gold)]"
            >
              {STATUSES.map(s => <option key={s} value={s} className="bg-[color:var(--color-surface)]">{STATUS_LABEL[s]}</option>)}
            </select>
            <NextStatusButton status={project.status} onAdvance={changeStatus} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-5 max-h-[55vh] md:max-h-none">
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} agents={allKnown} onDelete={() => deleteMessage(m.id)} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-[color:var(--color-line)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[color:var(--color-mute)]">Répond :</span>
            <select
              value={respondent}
              onChange={e => setRespondent(e.target.value)}
              className="bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-md text-xs px-2 py-1"
            >
              {respondable.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
          </div>

          {attachment && (
            <div className="mb-2 flex items-center gap-2 text-xs bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-3 py-1.5 w-fit">
              <Paperclip size={12} className="text-[color:var(--color-gold)]" />
              <span>{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <label className="w-11 h-11 shrink-0 rounded-lg border border-[color:var(--color-line)] flex items-center justify-center cursor-pointer hover:border-[color:var(--color-gold-dim)] transition-colors">
              <Paperclip size={16} className="text-[color:var(--color-ivory-dim)]" />
              <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFile} className="hidden" />
            </label>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Écris à l'équipe..."
              className="flex-1 bg-[color:var(--color-surface)] border border-[color:var(--color-line)] rounded-lg px-4 py-2.5 text-sm placeholder:text-[color:var(--color-mute)] focus:border-[color:var(--color-gold-dim)] outline-none"
            />
            <button
              onClick={send}
              disabled={sending || (!input.trim() && !attachment)}
              className="w-11 h-11 shrink-0 rounded-lg bg-[color:var(--color-gold)] flex items-center justify-center disabled:opacity-40"
            >
              <Send size={16} className="text-[color:var(--color-void)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Aperçu + panneaux */}
      <div className="flex flex-col w-full md:w-80 shrink-0 px-4 md:px-6 py-6 overflow-y-auto border-t md:border-t-0 border-[color:var(--color-line)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] mb-4">
          <Eye size={13} /> Aperçu du projet
        </div>
        <div className="border border-dashed border-[color:var(--color-line)] rounded-lg min-h-40 p-3 text-xs">
          <LivePreview projectId={project.id} />
        </div>

        <button
          onClick={advanceProject}
          disabled={advancing}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-[color:var(--color-gold)] text-[color:var(--color-void)] font-medium hover:bg-[color:var(--color-gold-bright)] disabled:opacity-50"
        >
          <Zap size={13} />
          {advancing ? 'Adrien travaille...' : 'Faire avancer le projet'}
        </button>
        <p className="text-[10px] text-[color:var(--color-mute)] mt-1.5">
          Le Manager décide seul de la prochaine étape. S'il a besoin de toi, il t'écrit en message privé.
        </p>

        <AssignTeamPanel project={project} projectAgents={projectAgents} onUpdate={loadAll} />
        <WorkPlanPanel project={project} onProjectUpdate={setProject} />
        <DeliveryPanel project={project} onProjectUpdate={setProject} />
        <ProjectJournal projectId={project.id} />
        <ProjectFiles project={project} onProjectUpdate={setProject} />
        <DeleteProjectPanel project={project} onProjectUpdate={setProject} />
      </div>
    </div>
  )
}

function NextStatusButton({ status, onAdvance }) {
  const NEXT = {
    idee: { to: 'valide', label: 'Valider ce projet →' },
    en_discussion: { to: 'valide', label: 'Valider ce projet →' },
    valide: { to: 'en_cours', label: 'Lancer le travail →' },
    en_cours: { to: 'livre', label: 'Marquer comme livré ✓' },
  }
  const next = NEXT[status]
  if (!next) return null
  return (
    <button
      onClick={() => onAdvance(next.to)}
      className="text-[10px] px-2 py-0.5 rounded-full bg-[color:var(--color-gold)] text-[color:var(--color-void)] font-medium hover:bg-[color:var(--color-gold-bright)]"
    >
      {next.label}
    </button>
  )
}

function MessageBubble({ message, agents, onDelete }) {
  const isUser = message.author_id === 'user'
  const agent = agents.find(a => a.id === message.author_id)

  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && agent && <AgentAvatar agent={agent} size="sm" />}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : ''} flex flex-col`}>
        {!isUser && (
          <span className="text-[11px] text-[color:var(--color-gold)] mb-1 font-medium">{message.author_name}</span>
        )}
        <div className={`flex items-start gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
          <div
            className={`px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
              isUser
                ? 'bg-[color:var(--color-gold)] text-[color:var(--color-void)]'
                : 'bg-[color:var(--color-surface)] border border-[color:var(--color-line)] text-[color:var(--color-ivory)]'
            }`}
          >
            <div className="prose-msg">
              {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 shrink-0 mt-1 flex items-center justify-center text-[color:var(--color-mute)] hover:text-[color:var(--color-danger)]"
            title="Supprimer ce message"
          >
            <Trash2 size={13} />
          </button>
          {!isUser && (
            <button
              onClick={() => downloadTextFile(`${message.author_name}-${Date.now()}.md`, message.content)}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 shrink-0 mt-1 flex items-center justify-center text-[color:var(--color-mute)] hover:text-[color:var(--color-gold)]"
              title="Télécharger ce message en document"
            >
              <Download size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
