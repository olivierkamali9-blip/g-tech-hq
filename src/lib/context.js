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
      .eq('agent_id', agentId).order('created_at', { ascending: false }).limit(5),
  ])

  const entries = [
    ...(fromMessages || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id))
      .map(m => ({ when: m.created_at, text: m.content })),
    ...(fromDm || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id) && m.author_id === agentId)
      .map(m => ({ when: m.created_at, text: m.content })),
  ]
    .sort((a, b) => new Date(a.when) - new Date(b.when))
    .slice(-6)

  if (entries.length === 0) return ''

  return `MÉMOIRE RÉCENTE (autres espaces) : ${entries.map(e => e.text.slice(0, 120)).join(' / ')}`
}
