import { supabase } from './supabase'

const READ_KEY = 'gtech-hq-dm-read'

function getReadMap() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}') } catch { return {} }
}

export function markThreadRead(agentId) {
  const map = getReadMap()
  map[agentId] = new Date().toISOString()
  localStorage.setItem(READ_KEY, JSON.stringify(map))
}

// Compte les messages d'agents (pas les tiens) reçus après ta dernière lecture de chaque fil.
export async function getUnreadCount() {
  const { data } = await supabase.from('dm_messages').select('agent_id, author_id, created_at')
  if (!data) return 0
  const readMap = getReadMap()
  let count = 0
  for (const m of data) {
    if (m.author_id === 'user') continue
    const lastRead = readMap[m.agent_id]
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) count++
  }
  return count
}
