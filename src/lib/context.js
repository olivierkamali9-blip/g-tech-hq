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

const HIERARCHY_TEXT = `HIÉRARCHIE : Olivier (CEO, décisions stratégiques seulement) → Adrien (Manager, coordonne tout, valide en dernier ressort) → Gabriel (CTO, valide technique), Inès (CPO, valide produit), Élise (Finance, valide argent), Nadia (Juridique, valide conformité) → Chef de Projet par projet (planifie, répartit, sollicite les validations, transmet à Adrien) → Développeurs/UX-UI/QA/DevOps (exécutent selon specs validées, rendent compte à leur Chef de Projet, pas à Adrien directement).`

// Vue d'ensemble de l'organisation : équipe réelle, projets réels, dernières décisions.
// Injecté dans CHAQUE appel à un agent pour qu'il ne parle jamais dans le vide. Volontairement compact pour économiser des tokens.
export async function getOrgSnapshot() {
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
