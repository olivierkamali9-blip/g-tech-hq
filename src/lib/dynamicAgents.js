import { supabase } from './supabase'
import { ALL_AGENTS, NAME_RESERVE } from '../data/agents'

export async function fetchDynamicAgents() {
  const { data } = await supabase.from('custom_agents').select('*').order('created_at', { ascending: true })
  return (data || []).map(a => ({
    id: a.id,
    name: a.name,
    role: a.role,
    title: a.title,
    engine: a.engine,
    initials: a.name.slice(0, 2).toUpperCase(),
    tier: 'pool',
  }))
}

export async function nextAvailableReserveName() {
  const { data } = await supabase.from('custom_agents').select('name')
  const taken = new Set([...ALL_AGENTS.map(a => a.name), ...(data || []).map(a => a.name)])
  return NAME_RESERVE.find(n => !taken.has(n)) || null
}

export async function createDynamicAgent({ name, role, title, engine }) {
  const id = 'custom-' + name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const { data, error } = await supabase.from('custom_agents').insert({ id, name, role, title, engine }).select().single()
  if (error) throw error
  return data
}
