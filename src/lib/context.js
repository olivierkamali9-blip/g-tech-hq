import { supabase } from './supabase'
import { ALL_AGENTS } from '../data/agents'
import { fetchDynamicAgents } from './dynamicAgents'

const STATUS_LABEL = {
  idee: 'idée',
  en_discussion: 'en discussion',
  valide: 'validé',
  en_cours: 'en cours',
  livre: 'livré',
}

export const BREVITY = "Réponds TRÈS BRIÈVEMENT — 1 à 3 phrases maximum, comme un vrai message entre collègues sur Slack, jamais un pavé. Pas d'intro, pas de conclusion, va droit au point utile. Ne rédige en plus long QUE si Olivier demande explicitement un document, un rapport ou du code."

export const PHILOSOPHY = `PHILOSOPHIE DE TRAVAIL DE G-TECH HQ (comment Olivier travaille avec Claude, et comment toute l'équipe doit fonctionner de la même façon) : ne jamais affirmer un fait sans le vérifier dans l'état réel fourni. Si tu ne sais pas ou que ce n'est pas encore fait, dis-le honnêtement plutôt que d'inventer. Face à une ambiguïté (style, fonctionnalité, choix technique important), pose une question précise à Olivier au lieu de deviner. Dis clairement ce qui est réalisable et ce qui ne l'est pas ou qui a des limites techniques réelles, même si ça déçoit — jamais de fausse promesse pour faire plaisir. Avance étape par étape, un travail concret à la fois, jamais du blabla vague. Ce que tu livres doit être fini et propre, pas une ébauche approximative. Prends la responsabilité de ton propre travail, ne rejette jamais une erreur sur un autre agent.`

export const PLAIN_LANGUAGE = `Olivier n'est PAS un développeur technique — ne lui parle jamais en jargon (pas de "fichiers mis à jour", "commit poussé", "endpoint", "build" sans explication). Explique toujours ce que tu as fait en langage simple et concret, comme à quelqu'un qui ne code pas mais comprend très bien les choses expliquées clairement : dis ce que ça change concrètement pour lui ou pour le projet, pas comment techniquement tu l'as fait. Jamais une phrase robotique creuse — une vraie phrase utile, comme un collègue qui prend le temps d'expliquer, exactement comme Claude le fait avec lui.`

export const QUALITY_STANDARD = `STANDARD DE QUALITÉ OBLIGATOIRE POUR TOUT CODE LIVRÉ (ne jamais transiger là-dessus, Olivier doit être impressionné, jamais déçu) :
- N'écris JAMAIS un fichier qui importe/référence un autre fichier que tu n'as pas aussi créé — un import vers un fichier inexistant casse tout le projet. Vérifie toujours que chaque chose que tu utilises existe vraiment dans les fichiers réels listés ou dans ce que tu crées maintenant.
- Ne mélange jamais deux applications différentes dans un seul projet (ex: un serveur backend ET un site web) sans les relier explicitement — un projet livré doit être UNE chose cohérente qui fonctionne, pas des morceaux séparés qui ne se parlent pas.
- Un .gitignore adapté à la stack (node_modules, .env, fichiers de build, etc.) dès le premier fichier de configuration.
- Un vrai README.md rédigé (pas la phrase brute d'Olivier recopiée) : nom du projet, description, stack utilisée, comment installer et lancer le projet, structure des dossiers.
- Un package.json (ou équivalent selon le langage) complet et cohérent, avec les bonnes dépendances et des scripts clairs (dev/build/start).
- Une arborescence professionnelle et cohérente pour toute la durée du projet — jamais un mélange de structures différentes : par exemple pour une app web, src/ avec des sous-dossiers clairs (components/, pages ou routes/, lib ou utils/, styles/ si pertinent).
- Un vrai point d'entrée qui relie tout (index.html qui charge le bon fichier principal, etc.) — le projet doit pouvoir se lancer avec un simple "installer puis démarrer", jamais des fragments déconnectés.
- Avant de dire qu'un travail est fini, demande-toi honnêtement : "si Olivier récupère ça et l'installe, est-ce que ça fonctionne vraiment ?" Si tu n'es pas sûr, ne dis pas que c'est prêt.
- Vise un résultat qui donnerait envie à Olivier de le montrer fièrement, pas le minimum qui coche juste une case.`

const HIERARCHY_TEXT = `HIÉRARCHIE : Olivier (CEO, décisions stratégiques seulement) → Adrien (Manager, coordonne tout, valide en dernier ressort) → Gabriel (CTO, valide technique), Inès (CPO, valide produit), Élise (Finance, valide argent), Nadia (Juridique, valide conformité) → Chef de Projet par projet (planifie, répartit, sollicite les validations, transmet à Adrien) → Développeurs/UX-UI/QA/DevOps (exécutent selon specs validées, rendent compte à leur Chef de Projet, pas à Adrien directement).`

// Vue d'ensemble de l'organisation : équipe réelle, projets réels, dernières décisions.
// Injecté dans CHAQUE appel à un agent pour qu'il ne parle jamais dans le vide. Volontairement compact pour économiser des tokens.
export async function getOrgSnapshot() {
  const now = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [{ data: projects }, { data: activity }, dynamicAgents] = await Promise.all([
    supabase.from('projects').select('id, name, status, lead_agent_id').order('created_at', { ascending: false }).limit(12),
    supabase.from('activity_log').select('label, created_at').order('created_at', { ascending: false }).limit(5),
    fetchDynamicAgents(),
  ])

  const allKnownAgents = [...ALL_AGENTS, ...dynamicAgents]
  const teamList = allKnownAgents.map(a => `${a.name}(${a.role})`).join(', ')

  const projectsList = (projects || []).length
    ? projects.map(p => `« ${p.name} »:${STATUS_LABEL[p.status] || p.status}`).join(', ')
    : "aucun."

  const activityList = (activity || []).length
    ? activity.map(a => a.label).join(' | ')
    : 'rien de récent.'

  return `--- CONTEXTE G-TECH HQ (ne jamais inventer au-delà) ---
DATE RÉELLE D'AUJOURD'HUI : ${now} — ne fais jamais d'erreur de date, ne confonds jamais avec une autre date, calcule les échéances à partir de CETTE date précise.
${HIERARCHY_TEXT}
${PHILOSOPHY}
ÉQUIPE RÉELLE : ${teamList}
PROJETS : ${projectsList}
DERNIÈRE ACTIVITÉ : ${activityList}
${BREVITY}
--- FIN CONTEXTE ---`
}

// Mémoire d'un agent à travers TOUS les espaces (projets, Réunion, messages privés).
export async function getAgentMemory(agentId, excludeCurrentThreadIds = []) {
  const [{ data: fromMessages }, { data: fromDm }] = await Promise.all([
    supabase.from('messages').select('id, project_id, author_id, content, created_at')
      .eq('author_id', agentId).order('created_at', { ascending: false }).limit(5),
    supabase.from('dm_messages').select('id, agent_id, author_id, content, created_at')
      .eq('agent_id', agentId).order('created_at', { ascending: false }).limit(10),
  ])

  const entries = [
    ...(fromMessages || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id))
      .map(m => ({ when: m.created_at, text: m.content })),
    ...(fromDm || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id))
      .map(m => ({ when: m.created_at, text: `${m.author_id === 'user' ? 'Olivier a dit' : 'Tu as dit'} : ${m.content}` })),
  ]
    .sort((a, b) => new Date(a.when) - new Date(b.when))
    .slice(-8)

  if (entries.length === 0) return ''

  return `MÉMOIRE RÉCENTE (autres espaces, y compris les réponses d'Olivier — ne les oublie jamais) : ${entries.map(e => e.text.slice(0, 140)).join(' / ')}`
}

// État réel d'un projet précis, utilisable depuis n'importe quel espace (y compris la messagerie privée).
export async function getProjectReality(projectId, forAgentId) {
  const [{ data: project }, { data: files }, { data: tasks }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_files').select('path, agent_id').eq('project_id', projectId).order('path'),
    supabase.from('project_tasks').select('agent_id, description, status').eq('project_id', projectId).order('sequence'),
  ])
  if (!project) return ''
  const myFiles = (files || []).filter(f => f.agent_id === forAgentId).map(f => f.path)
  const otherFiles = (files || []).filter(f => f.agent_id !== forAgentId).map(f => f.path)
  const myTasks = (tasks || []).filter(t => t.agent_id === forAgentId)
  const repoText = project.github_repo ? `Repo GitHub réel : github.com/olivierkamali9-blip/${project.github_repo}` : "AUCUN repo GitHub n'existe encore."
  const vercelText = project.vercel_url ? `Site en ligne réel : ${project.vercel_url}` : "AUCUN site déployé — ne donne jamais de lien Vercel tant que ce champ est vide."
  return `--- ÉTAT RÉEL DU PROJET "${project.name}" (vérité absolue, y compris dans cette conversation privée) ---
Statut : ${project.status}${project.orchestration_paused ? ' (plan EN PAUSE actuellement)' : ''}
${repoText}
${vercelText}
CE QUE TOI PRÉCISÉMENT AS FAIT : ${myFiles.length ? myFiles.join(', ') : 'rien encore'}
TES TÂCHES À TOI : ${myTasks.length ? myTasks.map(t => `[${t.status}] ${t.description}`).join(' | ') : 'aucune'}
CE QUE LE RESTE DE L'ÉQUIPE A FAIT (pas toi) : ${otherFiles.length ? otherFiles.join(', ') : 'rien encore'}
--- FIN ---`
}
