import { supabase } from './supabase'
import { ALL_AGENTS } from '../data/agents'

const STATUS_LABEL = {
  idee: 'idée',
  en_discussion: 'en discussion',
  valide: 'validé',
  en_cours: 'en cours',
  livre: 'livré',
}

// Vue d'ensemble de l'organisation : équipe réelle, projets réels, dernières décisions.
// Injecté dans CHAQUE appel à un agent pour qu'il ne parle jamais dans le vide.
export async function getOrgSnapshot() {
  const [{ data: projects }, { data: activity }] = await Promise.all([
    supabase.from('projects').select('id, name, status, lead_agent_id').order('created_at', { ascending: false }).limit(20),
    supabase.from('activity_log').select('label, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const teamList = ALL_AGENTS.map(a => `- ${a.name} (${a.role})${a.tier === 'pool' ? ' — réservoir, à assigner' : ' — direction'}`).join('\n')

  const projectsList = (projects || []).length
    ? projects.map(p => {
        const lead = ALL_AGENTS.find(a => a.id === p.lead_agent_id)
        return `- « ${p.name} » — statut : ${STATUS_LABEL[p.status] || p.status}${lead ? `, chef de projet : ${lead.name}` : ''}`
      }).join('\n')
    : "Aucun projet pour l'instant."

  const activityList = (activity || []).length
    ? activity.map(a => `- ${a.label}`).join('\n')
    : 'Aucune activité récente.'

  return `--- CONTEXTE RÉEL DE G-TECH HQ (à respecter strictement, ne jamais inventer) ---
ÉQUIPE RÉELLE (les seuls collègues qui existent, n'en invente jamais d'autres) :
${teamList}

PROJETS ACTUELS (${(projects || []).length} au total) :
${projectsList}

DERNIÈRES DÉCISIONS / ACTIVITÉ DE L'ORGANISATION :
${activityList}
--- FIN DU CONTEXTE ---`
}

// Mémoire d'un agent à travers TOUS les espaces (projets, Réunion, messages privés).
// Permet à un agent de rester cohérent même si la discussion a changé d'espace.
export async function getAgentMemory(agentId, excludeCurrentThreadIds = []) {
  const [{ data: fromMessages }, { data: fromDm }] = await Promise.all([
    supabase.from('messages').select('id, project_id, author_id, author_name, content, created_at')
      .eq('author_id', agentId).order('created_at', { ascending: false }).limit(8),
    supabase.from('dm_messages').select('id, agent_id, author_id, content, created_at')
      .eq('agent_id', agentId).order('created_at', { ascending: false }).limit(8),
  ])

  const entries = [
    ...(fromMessages || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id))
      .map(m => ({ when: m.created_at, text: `[${m.project_id ? 'projet' : 'réunion'}] Toi : ${m.content}` })),
    ...(fromDm || [])
      .filter(m => !excludeCurrentThreadIds.includes(m.id) && m.author_id === agentId)
      .map(m => ({ when: m.created_at, text: `[message privé avec Olivier] Toi : ${m.content}` })),
  ]
    .sort((a, b) => new Date(a.when) - new Date(b.when))
    .slice(-10)

  if (entries.length === 0) return ''

  return `--- TA MÉMOIRE RÉCENTE DANS D'AUTRES ESPACES (reste cohérent avec ce que tu as déjà dit) ---
${entries.map(e => `- ${e.text.slice(0, 220)}`).join('\n')}
--- FIN DE TA MÉMOIRE ---`
}
