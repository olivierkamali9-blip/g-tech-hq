// Registre des agents de G-Tech HQ.
// "leadership" = actifs en permanence, présents dans toutes les discussions de projet.
// "pool" = réservoir de talents, sans poste fixe tant qu'un projet ne les assigne pas.

export const LEADERSHIP = [
  {
    id: 'manager',
    role: 'Manager',
    title: 'Supervise, assigne les agents, valide avant publication',
    engine: 'gemini',
    initials: 'MG',
    tier: 'leadership',
  },
  {
    id: 'finance',
    role: 'Finance & Stratégie',
    title: 'Challenge la rentabilité, propose la monétisation',
    engine: 'mistral',
    initials: 'FS',
    tier: 'leadership',
  },
  {
    id: 'legal',
    role: 'Juridique',
    title: 'Vérifie la conformité légale des projets',
    engine: 'groq',
    initials: 'JU',
    tier: 'leadership',
  },
]

export const POOL = [
  { id: 'backend-1', role: 'Développeur Backend', title: 'APIs, bases de données, logique serveur', engine: 'mistral', initials: 'BE', tier: 'pool' },
  { id: 'frontend-1', role: 'Développeur Frontend', title: 'Interfaces, expérience utilisateur', engine: 'groq', initials: 'FE', tier: 'pool' },
  { id: 'design-1', role: 'Designer', title: 'Identité visuelle, maquettes, images', engine: 'gemini', initials: 'DS', tier: 'pool' },
  { id: 'writer-1', role: 'Rédaction & Documentation', title: 'Rapports, textes, documentation', engine: 'gemini', initials: 'RD', tier: 'pool' },
  { id: 'qa-1', role: 'Qualité & Tests', title: 'Vérifie le travail avant validation Manager', engine: 'groq', initials: 'QA', tier: 'pool' },
  { id: 'dev-2', role: 'Développeur (renfort)', title: 'Appui technique polyvalent', engine: 'openrouter', initials: 'DV', tier: 'pool' },
]

export const ALL_AGENTS = [...LEADERSHIP, ...POOL]

export const ENGINE_LABEL = {
  gemini: 'Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
}
