// Registre des agents de G-Tech HQ.
// "leadership" = actifs en permanence, présents dans toutes les discussions de projet.
// "pool" = réservoir de talents, sans poste fixe tant qu'un projet ne les assigne pas.
// Chaque agent a un prénom professionnel unique — jamais réutilisé, même pour les futurs agents créés par le Manager.

export const LEADERSHIP = [
  {
    id: 'manager',
    name: 'Adrien',
    role: 'Manager',
    title: 'Supervise, assigne les agents, valide avant publication',
    engine: 'gemini',
    initials: 'AD',
    tier: 'leadership',
  },
  {
    id: 'finance',
    name: 'Élise',
    role: 'Finance & Stratégie',
    title: 'Challenge la rentabilité, propose la monétisation',
    engine: 'mistral',
    initials: 'ÉL',
    tier: 'leadership',
  },
  {
    id: 'legal',
    name: 'Nadia',
    role: 'Juridique',
    title: 'Vérifie la conformité légale des projets',
    engine: 'groq',
    initials: 'NA',
    tier: 'leadership',
  },
]

export const POOL = [
  { id: 'backend-1', name: 'Julien', role: 'Développeur Backend', title: 'APIs, bases de données, logique serveur', engine: 'mistral', initials: 'JU', tier: 'pool' },
  { id: 'frontend-1', name: 'Sacha', role: 'Développeur Frontend', title: 'Interfaces, expérience utilisateur', engine: 'groq', initials: 'SA', tier: 'pool' },
  { id: 'design-1', name: 'Camille', role: 'Designer', title: 'Identité visuelle, maquettes, images', engine: 'gemini', initials: 'CA', tier: 'pool' },
  { id: 'writer-1', name: 'Louis', role: 'Rédaction & Documentation', title: 'Rapports, textes, documentation', engine: 'gemini', initials: 'LO', tier: 'pool' },
  { id: 'qa-1', name: 'Naomi', role: 'Qualité & Tests', title: 'Vérifie le travail avant validation Manager', engine: 'groq', initials: 'NO', tier: 'pool' },
  { id: 'dev-2', name: 'Malik', role: 'Développeur (renfort)', title: 'Appui technique polyvalent', engine: 'openrouter', initials: 'MA', tier: 'pool' },
]

export const ALL_AGENTS = [...LEADERSHIP, ...POOL]

// Réserve de prénoms disponibles pour les prochains agents créés par le Manager.
// À chaque création, on retire le prénom utilisé de cette liste pour garantir l'unicité.
export const NAME_RESERVE = [
  'Théo', 'Inès', 'Gabriel', 'Léa', 'Mathis', 'Amara', 'Victor', 'Chloé',
  'Samir', 'Alicia', 'Benoît', 'Diane', 'Yanis', 'Fiona', 'Hugo', 'Kenza',
]

export function usedNames() {
  return ALL_AGENTS.map(a => a.name)
}

// Retourne un prénom encore jamais utilisé, à donner à un nouvel agent.
export function nextAvailableName() {
  const taken = new Set(usedNames())
  return NAME_RESERVE.find(n => !taken.has(n)) || null
}

export const ENGINE_LABEL = {
  gemini: 'Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
}
