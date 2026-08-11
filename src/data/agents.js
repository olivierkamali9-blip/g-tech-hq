// Registre des agents de G-Tech HQ.
// "leadership" = actifs en permanence, présents dans toutes les discussions de projet.
// "pool" = réservoir de talents, sans poste fixe tant qu'un projet ne les assigne pas.
// Chaque agent a un prénom professionnel unique — jamais réutilisé, même pour les futurs agents créés par le Manager.

export const LEADERSHIP = [
  {
    id: 'manager',
    name: 'Adrien',
    role: 'Manager',
    title: 'Coordonne toute l\'organisation, attribue les tâches, valide le travail, arbitre les conflits, suit les projets, ne remonte à Olivier que les décisions stratégiques',
    engine: 'gemini',
    initials: 'AD',
    tier: 'leadership',
  },
  {
    id: 'cto',
    name: 'Gabriel',
    role: 'CTO',
    title: 'Valide l\'architecture technique, les technologies, les standards de code, la sécurité',
    engine: 'mistral',
    initials: 'GA',
    tier: 'leadership',
  },
  {
    id: 'cpo',
    name: 'Inès',
    role: 'CPO',
    title: 'Valide les fonctionnalités, les priorités produit, la cohérence avec la vision',
    engine: 'gemini',
    initials: 'IN',
    tier: 'leadership',
  },
  {
    id: 'finance',
    name: 'Élise',
    role: 'Finance & Stratégie',
    title: 'Valide les impacts financiers, veille à ce que TOUT reste gratuit ou au moindre coût possible (les projets G-Tech HQ visent le zéro-coût par défaut) — signale immédiatement toute suggestion payante avec son prix réel exact et propose systématiquement l\'alternative gratuite ou la moins chère',
    engine: 'mistral',
    initials: 'ÉL',
    tier: 'leadership',
  },
  {
    id: 'legal',
    name: 'Nadia',
    role: 'Juridique',
    title: 'Valide les contrats, licences, conformité et propriété intellectuelle',
    engine: 'groq',
    initials: 'NA',
    tier: 'leadership',
  },
]

export const POOL = [
  { id: 'backend-1', name: 'Julien', role: 'Développeur Backend', title: 'Implémente les fonctionnalités serveur selon les spécifications validées', engine: 'mistral', initials: 'JU', tier: 'pool' },
  { id: 'frontend-1', name: 'Sacha', role: 'Développeur Frontend', title: 'Implémente les interfaces selon les spécifications validées', engine: 'groq', initials: 'SA', tier: 'pool' },
  { id: 'design-1', name: 'Camille', role: 'UX/UI', title: 'Conçoit les interfaces, l\'identité visuelle, les maquettes', engine: 'gemini', initials: 'CA', tier: 'pool' },
  { id: 'writer-1', name: 'Louis', role: 'Rédaction & Documentation', title: 'Rapports, textes, documentation', engine: 'gemini', initials: 'LO', tier: 'pool' },
  { id: 'qa-1', name: 'Naomi', role: 'QA', title: 'Teste et valide la qualité avant transmission au Chef de Projet', engine: 'groq', initials: 'NO', tier: 'pool' },
  { id: 'devops-1', name: 'Léa', role: 'DevOps', title: 'Déploie et maintient l\'infrastructure (GitHub, Vercel, Supabase)', engine: 'mistral', initials: 'LE', tier: 'pool' },
  { id: 'dev-2', name: 'Malik', role: 'Développeur (renfort)', title: 'Appui technique polyvalent', engine: 'openrouter', initials: 'MA', tier: 'pool' },
]

export const ALL_AGENTS = [...LEADERSHIP, ...POOL]

// Réserve de prénoms disponibles pour les prochains agents créés par le Manager.
// À chaque création, on retire le prénom utilisé de cette liste pour garantir l'unicité.
export const NAME_RESERVE = [
  'Théo', 'Mathis', 'Amara', 'Victor', 'Chloé', 'Samir', 'Alicia',
  'Benoît', 'Diane', 'Yanis', 'Fiona', 'Hugo', 'Kenza', 'Nathan', 'Lina', 'Karim', 'Sophie',
  'Erwan', 'Nora', 'Bastien', 'Maya', 'Idriss', 'Clara', 'Romain', 'Yasmine', 'Antoine', 'Salomé',
  'Farid', 'Juliette', 'Noah', 'Zara', 'Cyril', 'Manon', 'Adam', 'Lucie', 'Bilal', 'Emma',
  'Baptiste', 'Aïcha', 'Simon', 'Rania', 'Elias', 'Sarah', 'Tristan', 'Nour', 'Marc', 'Iris',
  'Younes', 'Alix', 'Quentin', 'Dina', 'Loïc', 'Maëlys', 'Rayan', 'Célia', 'Vincent', 'Amina',
  'Timothée', 'Oriane', 'Anis', 'Pauline', 'Elouan', 'Safiya', 'Mehdi', 'Anaïs', 'Corentin', 'Yolande',
  'Kevin', 'Nesrine', 'Sami', 'Odile', 'Franck', 'Meriem', 'Damien', 'Aya', 'Hicham', 'Solène',
  'Rémi', 'Farah', 'Anouar', 'Blanche', 'Yacine', 'Coralie', 'Jonas', 'Malia', 'Sébastien', 'Nadège',
  'Wassim', 'Éva', 'Grégoire', 'Layla', 'Marwan', 'Océane', 'Idris', 'Prisca', 'Florent', 'Estelle',
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
