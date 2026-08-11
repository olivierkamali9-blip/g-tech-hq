import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { askAgent } from '../lib/engines'
import { getOrgSnapshot, getAgentMemory, QUALITY_STANDARD, PLAIN_LANGUAGE } from '../lib/context'
import { buildAnchoredHistory } from '../lib/history'
import { fetchDynamicAgents, nextAvailableReserveName, createDynamicAgent } from '../lib/dynamicAgents'
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
import Sandbox from '../components/Sandbox'
import CodeSandbox from '../components/CodeSandbox'
import ReactMarkdown from 'react-markdown'
import { Send, Eye, Trash2, Paperclip, X, Download, Zap, Pencil, Check } from 'lucide-react'

const FINANCE_KEYWORDS = ['budget', 'coût', 'cout', 'prix', 'rentab', 'monétis', 'monetis', 'argent', 'revenu', 'client', 'vendre', 'payant']
const LEGAL_KEYWORDS = ['légal', 'legal', 'loi', 'contrat', 'rgpd', 'données personnelles', 'donnees personnelles', 'droit', 'licence', 'conformité', 'conformite']
const TECH_KEYWORDS = ['architecture', 'technique', 'stack', 'sécurité', 'securite', 'base de données', 'base de donnees', 'api', 'performance', 'code', 'infrastructure']
const PRODUCT_KEYWORDS = ['fonctionnalité', 'fonctionnalite', 'feature', 'utilisateur', 'ux', 'interface', 'design', 'produit', 'parcours', 'expérience', 'experience']
const BACKEND_KEYWORDS = ['backend', 'serveur', 'route', 'endpoint']
const FRONTEND_KEYWORDS = ['frontend', 'composant', 'écran', 'ecran', 'page web', 'affichage']
const DESIGN_KEYWORDS = ['maquette', 'couleur', 'charte graphique', 'ergonomie']
const QA_KEYWORDS = ['test', 'bug', 'qualité', 'qualite', 'anomalie', 'régression', 'regression']
const DEVOPS_KEYWORDS = ['déploiement', 'deploiement', 'ci/cd', 'vercel', 'hébergement', 'hebergement']
const STATUSES = ['idee', 'en_discussion', 'valide', 'en_cours', 'livre']
const STATUS_LABEL = { idee: 'Idée', en_discussion: 'En discussion', valide: 'Validé', en_cours: 'En cours', livre: 'Livré' }
const BESOIN_RULE = `Quand tu sollicites Olivier via "BESOIN_OLIVIER:", respecte deux règles : 1) Ne pose QUE des questions pertinentes pour l'ÉTAPE ACTUELLE réelle du projet (regarde l'état réel ci-dessus — si rien n'est encore construit, ne demande jamais des détails avancés comme le suivi de bugs en production ou le processus de mise à jour futur, concentre-toi sur ce qui bloque VRAIMENT maintenant). 2) Comme un collègue compétent, ne pose jamais une question toute nue : propose systématiquement 2-3 suggestions concrètes et réalistes, avec ton avis sur la meilleure option, pour qu'Olivier n'ait qu'à valider ou ajuster plutôt que de partir de zéro.`
const BUDGET_RULE = `RÈGLE BUDGET : tous les projets de G-Tech HQ visent le ZÉRO-COÛT par défaut (services gratuits uniquement). Si une tâche ou un choix technique nécessite un outil, service ou abonnement payant, mentionne-le explicitement (avec le prix réel si tu le sais) et propose une alternative gratuite en priorité — n'engage rien de payant sans validation d'Élise (Finance).`

function detectConcernedAgent(text, candidates = []) {
  const lower = text.toLowerCase()
  const roleMatch = (keywords, roleSubstr) => candidates.find(a => a.role.toLowerCase().includes(roleSubstr) && keywords.some(k => lower.includes(k)))
  const hit = roleMatch(LEGAL_KEYWORDS, 'juridique') || roleMatch(FINANCE_KEYWORDS, 'finance')
    || roleMatch(TECH_KEYWORDS, 'cto') || roleMatch(PRODUCT_KEYWORDS, 'cpo')
    || roleMatch(BACKEND_KEYWORDS, 'backend') || roleMatch(FRONTEND_KEYWORDS, 'frontend')
    || roleMatch(DESIGN_KEYWORDS, 'ux/ui') || roleMatch(QA_KEYWORDS, 'qa') || roleMatch(DEVOPS_KEYWORDS, 'devops')
  return hit || null
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
  const [signal, setSignal] = useState(null)
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

  async function projectRealityText(forAgentId) {
    const [{ data: files }, { data: allTasks }] = await Promise.all([
      supabase.from('project_files').select('path, agent_id').eq('project_id', id).order('path'),
      supabase.from('project_tasks').select('agent_id, description, status').eq('project_id', id).order('sequence'),
    ])
    const myFiles = (files || []).filter(f => f.agent_id === forAgentId).map(f => f.path)
    const otherFiles = (files || []).filter(f => f.agent_id !== forAgentId).map(f => f.path)
    const myTasks = (allTasks || []).filter(t => t.agent_id === forAgentId)
    const otherDoneTasks = (allTasks || []).filter(t => t.agent_id !== forAgentId && t.status === 'done')

    const repoText = project.github_repo
      ? `Repo GitHub réel : github.com/olivierkamali9-blip/${project.github_repo}`
      : "AUCUN repo GitHub n'existe encore pour ce projet."
    const vercelText = project.vercel_url
      ? `Site en ligne réel : ${project.vercel_url}`
      : "AUCUN site n'est déployé — NE DONNE JAMAIS un lien Vercel à Olivier tant que ce champ est vide, même si le repo existe. Le déploiement Vercel est une action manuelle unique qu'Olivier doit faire lui-même (import du repo sur vercel.com) — mais AVANT de lui dire de le faire, vérifie dans la liste des fichiers réels ci-dessus qu'il existe bien un package.json (ou équivalent) ET un vrai point d'entrée (index.html, main.jsx, App.jsx ou similaire). Si ce n'est pas le cas, le déploiement donnera une page vide — dis-le clairement à Olivier et propose plutôt de finaliser les fondations d'abord."

    return `--- ÉTAT RÉEL DU PROJET (vérité absolue — ne dis JAMAIS avoir fait quelque chose que TOI n'as pas fait) ---
${repoText}
${vercelText}
CE QUE TOI PRÉCISÉMENT AS RÉELLEMENT FAIT : ${myFiles.length ? myFiles.join(', ') : "RIEN encore — si on te demande ce que tu as fait, dis honnêtement que tu n'as encore rien produit."}
TES TÂCHES À TOI : ${myTasks.length ? myTasks.map(t => `[${t.status}] ${t.description}`).join(' | ') : "Aucune tâche ne t'a été assignée sur ce projet pour l'instant — dis-le clairement si on te le demande, ne réponds pas comme si tu avais travaillé."}
CE QUE LE RESTE DE L'ÉQUIPE A FAIT (pas toi — n'en prends jamais le crédit) : ${otherFiles.length ? otherFiles.join(', ') : 'rien encore'}${otherDoneTasks.length ? ' | tâches faites par d\'autres : ' + otherDoneTasks.map(t => t.description).join(', ') : ''}
--- FIN ÉTAT RÉEL ---`
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
      const allPoolNow = [...POOL, ...dynamicAgents]
      const assignedNow = allPoolNow.filter(a => projectAgents.some(pa => pa.agent_id === a.id))

      // Adrien évalue d'abord si l'équipe actuelle suffit, ou s'il faut créer un nouveau poste
      let extraAgentNote = ''
      try {
        const poolList = allPoolNow.map(a => `${a.id} = ${a.name} (${a.role})`).join('\n')
        const check = await askAgent(
          MANAGER.engine,
          `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\nProjet "${currentProject.name}" (${currentProject.description}). Voici le réservoir de talents disponible :\n${poolList}\n\nCe réservoir couvre-t-il vraiment les compétences nécessaires pour CE projet précis ? Si un poste manque clairement (ex: Data Scientist, Motion Designer, Spécialiste paiement...), réponds UNIQUEMENT : NOUVEL_AGENT: <poste> | <fonction en une phrase> | <moteur parmi gemini/groq/mistral/openrouter>. Sinon réponds UNIQUEMENT : NON.`,
          [{ role: 'user', content: 'Évalue maintenant.' }]
        )
        const m = check.match(/NOUVEL_AGENT:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(gemini|groq|mistral|openrouter)/i)
        if (m) {
          const name = await nextAvailableReserveName()
          if (name) {
            const created = await createDynamicAgent({ name, role: m[1].trim(), title: m[2].trim(), engine: m[3].trim() })
            await supabase.from('project_agents').insert({ project_id: id, agent_id: created.id, role_in_project: 'Recruté par Adrien pour ce projet' })
            await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a recruté ${name} (${m[1].trim()}) pour ce projet` })
            await supabase.from('dm_messages').insert({
              agent_id: 'manager', author_id: 'manager', project_id: id,
              content: `J'ai constaté qu'il nous manquait un profil "${m[1].trim()}" pour ce projet, donc j'ai intégré **${name}** à l'équipe. Je continue la planification.`,
            })
            extraAgentNote = `\nNouvel agent recruté pour ce projet : ${name} (id: ${created.id}, ${m[1].trim()}) — utilise-le dans le plan si pertinent.`
          }
        }
      } catch (e) {}

      const raw = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\n${projectTeamText()}${extraAgentNote}\n\nOlivier vient de lancer le travail sur "${currentProject.name}" (${currentProject.description}). Découpe ce projet en 4 à 10 tâches concrètes, actionnables, dans l'ordre logique d'exécution. RÈGLE ABSOLUE N°1 : la toute première tâche doit TOUJOURS être de poser les fondations techniques réelles et exécutables du projet (choix de la stack, fichier de config/build comme package.json, point d'entrée de l'application) — jamais des morceaux isolés (un composant par-ci, une route par-là) sans squelette qui les relie. Une "application" n'existe que si elle peut vraiment se lancer. RÈGLE N°2 : si des agents sont listés dans MEMBRES SOUS SA SUPERVISION ci-dessus, la majorité des tâches DOIVENT leur être assignées à EUX (utilise leurs id exacts), pas à toi-même — tu ne t'assignes des tâches à toi-même QUE si aucun agent n'est assigné au projet, ou pour les étapes de coordination/validation qui te reviennent vraiment. RÈGLE N°3 : ${BUDGET_RULE} Insère une tâche de validation "finance" si le projet risque d'impliquer un outil/service payant. Réponds UNIQUEMENT avec ce format, une ligne par tâche, rien d'autre :\nTACHE: <id de l'agent> | <description courte et actionnable>`,
        [{ role: 'user', content: 'Découpe le projet en tâches maintenant.' }]
      )
      const lines = [...raw.matchAll(/TACHE:\s*([a-z0-9-]+)\s*\|\s*(.+)/gi)]
      let tasks = lines.map((m, i) => ({ project_id: id, agent_id: m[1].trim(), description: m[2].trim(), sequence: i }))

      // Filet de sécurité : si une équipe est assignée mais qu'Adrien garde presque tout pour lui, on redistribue
      const assignableIds = assignedNow.map(a => a.id)
      if (assignableIds.length > 0) {
        const nonManagerCount = tasks.filter(t => t.agent_id !== 'manager').length
        if (nonManagerCount < Math.ceil(tasks.length / 2)) {
          let cursor = 0
          tasks = tasks.map(t => {
            const isValidation = /valid/i.test(t.description)
            if (t.agent_id === 'manager' && !isValidation) {
              const reassigned = assignableIds[cursor % assignableIds.length]
              cursor++
              return { ...t, agent_id: reassigned }
            }
            return t
          })
        }
      }

      if (tasks.length > 0) {
        await supabase.from('project_tasks').insert(tasks)
        await supabase.from('projects').update({ orchestration_paused: false }).eq('id', id)
        await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a établi un plan de ${tasks.length} tâches` })
      }
    } catch (e) {}
  }

  async function autoSaveAndPublish(files, agentId) {
    if (files.length === 0) return
    for (const f of files) {
      await supabase.from('project_files').upsert({ project_id: id, path: f.path, content: f.content, agent_id: agentId }, { onConflict: 'project_id,path' })
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
      const history = buildAnchoredHistory([...messages, saved]).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const [orgContext, agentMemory, realityText] = await Promise.all([getOrgSnapshot(), getAgentMemory(agent.id), projectRealityText(agent.id)])
      const managerTaskInstruction = agent.id === 'manager'
        ? `\n\nTu es aussi responsable de suivre cette discussion : si Olivier valide clairement une nouvelle idée, un ajout ou une modification cohérente avec le projet, traduis-la en tâche(s) concrète(s) pour l'équipe en ajoutant, à la fin de ta réponse, une ou plusieurs lignes "NOUVELLE_TACHE: <id agent> | <description courte>" (elles seront ajoutées automatiquement au plan de travail). Ne le fais QUE si c'est vraiment validé/clair dans cet échange, pas sur une simple suggestion floue.`
        : `\n\nRÈGLE ABSOLUE : ne promets JAMAIS de faire quelque chose "plus tard", "bientôt" ou "je vais m'en occuper" sans agir maintenant. Si tu peux le produire tout de suite (un document, un fichier), fais-le DANS CETTE RÉPONSE avec le format FICHIER. Si ça demande plusieurs étapes futures, propose une vraie tâche suivie en ajoutant à la fin de ta réponse une ligne "NOUVELLE_TACHE: ${agent.id} | <description courte de ce que tu feras>" — Adrien la validera avant qu'elle soit ajoutée au plan, c'est normal, ce n'est pas automatique.`
      const reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ, l'espace de travail multi-agents d'Olivier. Ton rôle : ${agent.title}.\n\n${orgContext}\n\n${projectTeamText()}\n\n${realityText}\n\n${agentMemory}\n\nLe projet en cours s'appelle "${project?.name}". Ne parle QUE de ce qui relève de ton rôle ; si une question dépasse ton domaine, dis que c'est à un autre membre de l'ÉQUIPE DE CE PROJET de répondre (nomme-le). Ne connais et ne cite jamais un collègue qui n'est pas listé dans le contexte ci-dessus — s'inventer un nom est une faute grave.\n\nSi une décision de style, couleur, interface ou fonctionnalité est ambiguë et pas encore précisée par Olivier, NE DÉCIDE PAS seul — pose la question via "BESOIN_OLIVIER:" plutôt que d'inventer un choix.${managerTaskInstruction}\n\nSi tu écris du code, ${QUALITY_STANDARD} ${BUDGET_RULE} Utilise EXACTEMENT ce format pour chaque fichier :\nFICHIER: chemin/du/fichier.ext\n\`\`\`langage\ncontenu complet du fichier\n\`\`\`\nIMPORTANT : dans ta réponse visible (en dehors des blocs FICHIER et NOUVELLE_TACHE), ne recopie JAMAIS le code ni son contenu — Olivier ne veut pas le voir défiler dans le chat, seulement sur GitHub. ${PLAIN_LANGUAGE} Tu n'es pas obligé d'utiliser Supabase/Vercel par défaut — propose la meilleure architecture selon le projet. Si une action nécessite qu'Olivier fasse quelque chose lui-même, termine ta réponse par une ligne "BESOIN_OLIVIER:" suivie des étapes précises numérotées. ${BESOIN_RULE} Si Olivier te demande un document, rédige-le entièrement en markdown.`,
        history
      )
      const [visiblePart, needRaw] = reply.split(/BESOIN_OLIVIER:/i)
      const cleanVisible = visiblePart.replace(/NOUVELLE_TACHE:.*$/gim, '').trim()
      const agentMsg = { project_id: id, author_id: agent.id, author_name: agent.name, content: stripFileBlocks(cleanVisible) }
      const { data: savedReply } = await supabase.from('messages').insert(agentMsg).select().single()
      setMessages(prev => [...prev, savedReply])

      const files = extractFilesFromMessage(reply)
      if (files.length > 0) await autoSaveAndPublish(files, agent.id)

      const newTaskLines = [...reply.matchAll(/NOUVELLE_TACHE:\s*([a-z0-9-]+)\s*\|\s*(.+)/gi)]
      if (newTaskLines.length > 0) {
        const { count: existingCount } = await supabase.from('project_tasks').select('id', { count: 'exact', head: true }).eq('project_id', id)
        const proposed = newTaskLines.map((m, i) => ({ project_id: id, agent_id: m[1].trim(), description: m[2].trim(), sequence: (existingCount || 0) + i }))

        if (agent.id === 'manager') {
          // Adrien est déjà le validateur — pas besoin de repasser par lui-même
          await supabase.from('project_tasks').insert(proposed)
          await supabase.from('activity_log').insert({ project_id: id, label: `${agent.name} a ajouté ${proposed.length} tâche(s) suite à la discussion` })
        } else {
          // Toute tâche proposée par un autre agent doit être validée par Adrien avant d'exister vraiment
          try {
            const MANAGER = LEADERSHIP.find(a => a.id === 'manager')
            const proposalText = proposed.map(p => `- ${p.agent_id} | ${p.description}`).join('\n')
            const verdict = await askAgent(
              MANAGER.engine,
              `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\n${projectTeamText()}\n\n${agent.name} (${agent.role}) propose ces tâches pour le projet "${project?.name}" :\n${proposalText}\n\nTu es le seul à valider les tâches pour garder l'équipe cohérente. Pour chaque proposition, réponds sur une ligne séparée : APPROUVE: <description exacte> ou REJETTE: <description exacte> | <raison courte>.`,
              [{ role: 'user', content: 'Valide ou rejette ces propositions maintenant.' }]
            )
            const approved = proposed.filter(p => new RegExp(`APPROUVE:\\s*${p.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(verdict))
            if (approved.length > 0) {
              await supabase.from('project_tasks').insert(approved)
              await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a validé ${approved.length} tâche(s) proposée(s) par ${agent.name}` })
            }
            const rejectedCount = proposed.length - approved.length
            if (rejectedCount > 0) {
              await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a refusé ${rejectedCount} proposition(s) de ${agent.name}` })
            }
          } catch (e) {}
        }
      }

      if (needRaw && needRaw.trim()) {
        await supabase.from('dm_messages').insert({
          agent_id: agent.id, author_id: agent.id, project_id: id,
          content: `À propos du projet **${project.name}** :\n\n${needRaw.trim()}`,
        })
      }

      const candidates = respondable.filter(a => a.id !== agent.id)
      if (candidates.length > 0) {
        try {
          const MANAGER = LEADERSHIP.find(a => a.id === 'manager')
          const candidateList = candidates.map(a => `${a.id} = ${a.name} (${a.role})`).join('\n')
          const verdict = await askAgent(
            MANAGER.engine,
            `Voici l'équipe disponible pour ce projet :\n${candidateList}\n\nDernier échange :\nOlivier : ${text}\n${agent.name} : ${reply}\n\nUn de ces agents a-t-il vraiment quelque chose d'IMPORTANT à ajouter — un problème détecté dans son domaine d'expertise, une suggestion concrète et utile, ou une proposition de tâche/validation ? Ne signale PAS pour un simple commentaire ou une remarque triviale hors-sujet. Réponds UNIQUEMENT avec l'id exact de l'agent concerné, ou NON s'il n'y a vraiment rien d'important à ajouter.`,
            [{ role: 'user', content: 'Évalue maintenant, en un mot.' }]
          )
          const matchId = candidates.find(a => new RegExp(`\\b${a.id}\\b`, 'i').test(verdict))?.id
          setSignal(matchId ? candidates.find(a => a.id === matchId) : null)
        } catch (e) {
          setSignal(null)
        }
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
      const history = buildAnchoredHistory(messages).map(m => ({
        role: m.author_id === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const [orgContext, agentMemory, realityText] = await Promise.all([getOrgSnapshot(), getAgentMemory(MANAGER.id), projectRealityText(MANAGER.id)])
      const decision = await askAgent(
        MANAGER.engine,
        `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${orgContext}\n\n${projectTeamText()}\n\n${realityText}\n\n${agentMemory}\n\nLe projet "${project?.name}" est en cours. IMPORTANT : tu ne peux QUE toi-même agir maintenant (les autres agents de l'équipe ne travaillent pas en arrière-plan, ils n'agissent que quand Olivier leur écrit directement). Donc soit tu fais toi-même une action concrète MAINTENANT (écrire un fichier, une décision, un document), soit tu dis clairement à Olivier quel agent il doit aller solliciter et pourquoi — ne prétends jamais qu'un autre agent est "en train de" faire quelque chose s'il n'a pas été sollicité, et ne prétends jamais qu'un fichier existe s'il n'est pas dans l'état réel ci-dessus. ${BUDGET_RULE} Si tu écris du code, ${QUALITY_STANDARD} Utilise EXACTEMENT ce format par fichier :\nFICHIER: chemin/du/fichier.ext\n\`\`\`langage\ncontenu complet\n\`\`\`\nNe recopie jamais le code dans ta réponse visible en dehors de ce format. ${PLAIN_LANGUAGE} SEULEMENT si une action nécessite absolument Olivier (compte à créer, SQL à coller...), termine par "BESOIN_OLIVIER:" suivi des étapes précises numérotées. ${BESOIN_RULE} Si une échéance concrète se dégage, ajoute une ligne "DEADLINE: <titre court> | <date AAAA-MM-JJ>". Sois concis, en français.`,
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
      if (files.length > 0) await autoSaveAndPublish(files, MANAGER.id)

      await supabase.from('activity_log').insert({ project_id: id, label: `${MANAGER.name} a fait avancer « ${project.name} »` })

      if (needPart && needPart.trim()) {
        await supabase.from('dm_messages').insert({
          agent_id: MANAGER.id, author_id: MANAGER.id, project_id: id,
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
          {signal && (
            <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-[color:var(--color-gold)]/10 border border-[color:var(--color-gold-dim)] text-xs">
              <span>🖐 <strong>{signal.name}</strong> ({signal.role}) semble concerné par ce sujet</span>
              <button
                onClick={() => { setRespondent(signal.id); setSignal(null) }}
                className="px-2 py-1 rounded-md bg-[color:var(--color-gold)] text-[color:var(--color-void)] font-medium shrink-0"
              >
                Donner la parole
              </button>
            </div>
          )}
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
        <CodeSandbox project={project} />
        <WorkPlanPanel project={project} onProjectUpdate={setProject} />
        <Sandbox project={project} agent={allKnown.find(a => a.id === project.lead_agent_id) || LEADERSHIP.find(a => a.id === 'manager')} />
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
