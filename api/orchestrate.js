// Orchestrateur — s'exécute côté serveur, indépendamment du navigateur d'Olivier.
// Prend la prochaine tâche en attente d'un projet "en_cours" (non en pause), la fait exécuter
// par le bon agent, sauvegarde/publie le résultat, et marque la tâche terminée.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const GITHUB_OWNER = 'olivierkamali9-blip'

const LEADERSHIP = [
  { id: 'manager', name: 'Adrien', role: 'Manager', engine: 'gemini' },
  { id: 'cto', name: 'Gabriel', role: 'CTO', engine: 'mistral' },
  { id: 'cpo', name: 'Inès', role: 'CPO', engine: 'gemini' },
  { id: 'finance', name: 'Élise', role: 'Finance & Stratégie', engine: 'mistral' },
  { id: 'legal', name: 'Nadia', role: 'Juridique', engine: 'groq' },
]
const POOL = [
  { id: 'backend-1', name: 'Julien', role: 'Développeur Backend', engine: 'mistral' },
  { id: 'frontend-1', name: 'Sacha', role: 'Développeur Frontend', engine: 'groq' },
  { id: 'design-1', name: 'Camille', role: 'UX/UI', engine: 'gemini' },
  { id: 'writer-1', name: 'Louis', role: 'Rédaction & Documentation', engine: 'gemini' },
  { id: 'qa-1', name: 'Naomi', role: 'QA', engine: 'groq' },
  { id: 'devops-1', name: 'Léa', role: 'DevOps', engine: 'mistral' },
  { id: 'dev-2', name: 'Malik', role: 'Développeur (renfort)', engine: 'openrouter' },
]

const HIERARCHY_TEXT = `HIÉRARCHIE : Olivier (CEO) → Adrien (Manager) → Gabriel(CTO)/Inès(CPO)/Élise(Finance)/Nadia(Juridique) → Chef de Projet par projet → Développeurs/UX-UI/QA/DevOps (rendent compte à leur Chef de Projet).`
const PHILOSOPHY = `PHILOSOPHIE : ne jamais affirmer un fait sans le vérifier dans l'état réel fourni. Si tu ne sais pas, dis-le honnêtement plutôt que d'inventer. Face à une ambiguïté (style, fonctionnalité), pose une question précise via BESOIN_OLIVIER au lieu de deviner. Ce que tu livres doit être fini et propre. Prends la responsabilité de ton travail, ne rejette jamais une erreur sur un autre agent.`
const BREVITY = "Réponds BRIÈVEMENT (2-5 phrases hors code), comme un message entre collègues, jamais un pavé."

const KEYS = {
  gemini: process.env.VITE_GEMINI_API_KEY,
  groq: process.env.VITE_GROQ_API_KEY,
  mistral: process.env.VITE_MISTRAL_API_KEY,
  openrouter: process.env.VITE_OPENROUTER_API_KEY,
}

async function callGemini(systemPrompt, userText) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${KEYS.gemini}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: userText }] }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Gemini')
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
async function callGroq(systemPrompt, userText) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEYS.groq}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Groq')
  return data?.choices?.[0]?.message?.content ?? ''
}
async function callMistral(systemPrompt, userText) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEYS.mistral}` },
    body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Mistral')
  return data?.choices?.[0]?.message?.content ?? ''
}
async function callOpenRouter(systemPrompt, userText) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEYS.openrouter}` },
    body: JSON.stringify({ model: 'openrouter/free', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur OpenRouter')
  return data?.choices?.[0]?.message?.content ?? ''
}
const ENGINES = { gemini: callGemini, groq: callGroq, mistral: callMistral, openrouter: callOpenRouter }

async function askAgent(engine, systemPrompt, userText) {
  const order = [engine, ...Object.keys(ENGINES).filter(e => e !== engine)]
  let lastError = null
  for (const tryEngine of order) {
    if (!KEYS[tryEngine]) continue
    try { return await ENGINES[tryEngine](systemPrompt, userText) }
    catch (e) {
      lastError = e
      const msg = String(e.message).toLowerCase()
      const transient = msg.includes('quota') || msg.includes('429') || msg.includes('rate limit') || msg.includes('tpm') || msg.includes('too large')
      if (!transient) throw e
    }
  }
  throw new Error(lastError?.message || 'Tous les moteurs indisponibles')
}

function extractFiles(text) {
  const files = []
  const regex = /FICHIER:\s*(\S+)\s*\n```[a-zA-Z0-9]*\n([\s\S]*?)```/g
  let m
  while ((m = regex.exec(text)) !== null) files.push({ path: m[1].trim(), content: m[2].replace(/\n$/, '') })
  return files
}
function stripFileBlocks(text) {
  const cleaned = text.replace(/FICHIER:\s*\S+\s*\n```[a-zA-Z0-9]*\n[\s\S]*?```/g, '').trim()
  return cleaned || 'Fichier mis à jour — disponible sur GitHub.'
}
function slugify(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'projet'
}

async function ghFetch(path, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', ...options.headers },
  })
}

async function publishFiles(repoName, description, files) {
  const check = await ghFetch(`/repos/${GITHUB_OWNER}/${repoName}`)
  if (check.status === 404) {
    await ghFetch('/user/repos', { method: 'POST', body: JSON.stringify({ name: repoName, description: description || '', private: false, auto_init: true }) })
    await new Promise(r => setTimeout(r, 1500))
  }
  for (const file of files) {
    const contentB64 = Buffer.from(file.content, 'utf-8').toString('base64')
    let sha
    const existing = await ghFetch(`/repos/${GITHUB_OWNER}/${repoName}/contents/${encodeURIComponent(file.path)}`)
    if (existing.ok) sha = (await existing.json()).sha
    await ghFetch(`/repos/${GITHUB_OWNER}/${repoName}/contents/${encodeURIComponent(file.path)}`, {
      method: 'PUT',
      body: JSON.stringify({ message: sha ? `Mise à jour : ${file.path}` : `Ajout : ${file.path}`, content: contentB64, sha }),
    })
  }
}

async function buildContext(projectId) {
  const [{ data: dyn }, { data: projects }, { data: activity }] = await Promise.all([
    supabase.from('custom_agents').select('*'),
    supabase.from('projects').select('id, name, status, lead_agent_id').order('created_at', { ascending: false }).limit(12),
    supabase.from('activity_log').select('label').order('created_at', { ascending: false }).limit(5),
  ])
  const dynamicAgents = (dyn || []).map(a => ({ id: a.id, name: a.name, role: a.role, engine: a.engine }))
  const allKnown = [...LEADERSHIP, ...POOL, ...dynamicAgents]
  const teamList = allKnown.map(a => `${a.name}(${a.role})`).join(', ')
  const projectsList = (projects || []).map(p => `« ${p.name} »:${p.status}`).join(', ')
  const activityList = (activity || []).map(a => a.label).join(' | ') || 'rien'

  const { data: projectAgents } = await supabase.from('project_agents').select('*').eq('project_id', projectId)
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  const lead = allKnown.find(a => a.id === project?.lead_agent_id)
  const members = (projectAgents || []).filter(pa => pa.agent_id !== project?.lead_agent_id)
    .map(pa => { const a = allKnown.find(x => x.id === pa.agent_id); return a ? `${a.name}(${a.role})${pa.role_in_project ? ':' + pa.role_in_project : ''}` : null })
    .filter(Boolean).join(', ')
  const teamText = lead
    ? `CHEF DE CE PROJET : ${lead.name}. MEMBRES : ${members || 'aucun autre'}.`
    : "Aucun chef de projet désigné."

  const [{ data: files }, { data: allTasks }] = await Promise.all([
    supabase.from('project_files').select('path, agent_id').eq('project_id', projectId).order('path'),
    supabase.from('project_tasks').select('agent_id, description, status').eq('project_id', projectId).order('sequence'),
  ])
  function realityFor(forAgentId) {
    const myFiles = (files || []).filter(f => f.agent_id === forAgentId).map(f => f.path)
    const otherFiles = (files || []).filter(f => f.agent_id !== forAgentId).map(f => f.path)
    const myTasks = (allTasks || []).filter(t => t.agent_id === forAgentId)
    const repoText = project?.github_repo ? `Repo GitHub réel : github.com/olivierkamali9-blip/${project.github_repo}` : "AUCUN repo GitHub n'existe encore."
    const vercelText = project?.vercel_url
      ? `Site en ligne réel : ${project.vercel_url}`
      : "AUCUN site déployé — NE DONNE JAMAIS de lien Vercel tant que ce champ est vide. Le déploiement est une action manuelle unique d'Olivier (import du repo sur vercel.com). Si le code est prêt à déployer, explique-lui via BESOIN_OLIVIER, précisément : 1) aller sur vercel.com et se connecter avec son compte GitHub habituel, 2) cliquer Add New > Project, 3) chercher et importer le repo '${project?.github_repo || '(pas encore créé)'}', 4) laisser les réglages par défaut et cliquer Deploy, 5) une fois prêt, coller le lien obtenu dans le panneau Livraison du projet."
    return `--- ÉTAT RÉEL DU PROJET (vérité absolue) ---\n${repoText}\n${vercelText}\nCE QUE TOI PRÉCISÉMENT AS FAIT : ${myFiles.length ? myFiles.join(', ') : "RIEN encore — dis-le honnêtement si on te le demande."}\nTES TÂCHES À TOI : ${myTasks.length ? myTasks.map(t => `[${t.status}] ${t.description}`).join(' | ') : 'aucune tâche ne t\'a été assignée.'}\nCE QUE LE RESTE DE L'ÉQUIPE A FAIT (pas toi) : ${otherFiles.length ? otherFiles.join(', ') : 'rien encore'}\n--- FIN ---`
  }

  return {
    allKnown, project,
    orgText: `--- CONTEXTE G-TECH HQ ---\n${HIERARCHY_TEXT}\n${PHILOSOPHY}\nÉQUIPE : ${teamList}\nPROJETS : ${projectsList}\nACTIVITÉ RÉCENTE : ${activityList}\n${BREVITY}\n--- FIN ---`,
    teamText, realityFor,
  }
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.ORCHESTRATE_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' })
  }

  try {
    const { data: candidates } = await supabase
      .from('project_tasks')
      .select('*, projects!inner(id, name, description, status, orchestration_paused, github_repo)')
      .eq('status', 'pending')
      .eq('projects.status', 'en_cours')
      .eq('projects.orchestration_paused', false)
      .order('sequence', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)

    const task = candidates?.[0]
    if (!task) return res.status(200).json({ done: true, message: 'Rien à exécuter pour le moment.' })

    await supabase.from('project_tasks').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', task.id)

    const project = task.projects
    const { orgText, teamText, realityFor, allKnown } = await buildContext(project.id)
    const agent = allKnown.find(a => a.id === task.agent_id) || LEADERSHIP.find(a => a.id === 'manager')

    let reply
    try {
      reply = await askAgent(
        agent.engine,
        `Tu es ${agent.name}, "${agent.role}" dans G-Tech HQ.\n\n${orgText}\n\n${teamText}\n\n${realityFor(agent.id)}\n\nProjet : "${project.name}" (${project.description}). Ta tâche assignée : "${task.description}". Exécute-la maintenant, directement, sans demander confirmation pour ce qui est purement technique. MAIS si un choix de style, couleur, interface ou fonctionnalité est ambigu et qu'Olivier ne l'a pas précisé, NE DÉCIDE PAS seul — termine par "BESOIN_OLIVIER:" et pose la question précisément au lieu d'inventer un choix. Si tu écris du code, structure-le professionnellement dans une arborescence cohérente (pas de mélange src/ à la racine et ailleurs), avec un vrai README si pertinent (jamais une simple phrase recopiée). Utilise EXACTEMENT :\nFICHIER: chemin/fichier.ext\n\`\`\`langage\ncontenu\n\`\`\`\nNe recopie jamais le code hors de ce format. SEULEMENT si tu as absolument besoin d'Olivier (compte, SQL...), termine par "BESOIN_OLIVIER:" suivi des étapes numérotées.`,
        'Exécute cette tâche maintenant.'
      )
    } catch (e) {
      await supabase.from('project_tasks').update({ status: 'failed', result_summary: e.message, updated_at: new Date().toISOString() }).eq('id', task.id)
      await supabase.from('projects').update({ orchestration_paused: true }).eq('id', project.id)
      await supabase.from('dm_messages').insert({
        agent_id: 'manager', author_id: 'manager',
        content: `Une tâche a échoué sur **${project.name}** ("${task.description}") : ${e.message}. J'ai mis le plan en pause, dis-moi comment tu veux continuer.`,
      })
      return res.status(200).json({ error: e.message, taskId: task.id })
    }

    const [visiblePart, needRaw] = reply.split(/BESOIN_OLIVIER:/i)
    await supabase.from('messages').insert({
      project_id: project.id, author_id: agent.id, author_name: agent.name, content: stripFileBlocks(visiblePart.trim()),
    })

    const files = extractFiles(reply)
    if (files.length > 0) {
      for (const f of files) {
        await supabase.from('project_files').upsert({ project_id: project.id, path: f.path, content: f.content, agent_id: agent.id }, { onConflict: 'project_id,path' })
      }
      const repoName = project.github_repo || slugify(project.name)
      try {
        await publishFiles(repoName, project.description, files)
        if (!project.github_repo) await supabase.from('projects').update({ github_repo: repoName }).eq('id', project.id)
        await supabase.from('activity_log').insert({ project_id: project.id, label: `${agent.name} a publié ${files.length} fichier(s) sur GitHub` })
      } catch (e) {}
    }

    await supabase.from('project_tasks').update({ status: 'done', result_summary: visiblePart.trim().slice(0, 150), updated_at: new Date().toISOString() }).eq('id', task.id)
    await supabase.from('activity_log').insert({ project_id: project.id, label: `${agent.name} a terminé : ${task.description.slice(0, 80)}` })

    if (needRaw && needRaw.trim()) {
      await supabase.from('projects').update({ orchestration_paused: true }).eq('id', project.id)
      await supabase.from('dm_messages').insert({
        agent_id: agent.id, author_id: agent.id,
        content: `À propos du projet **${project.name}** :\n\n${needRaw.trim()}\n\n(Le plan est en pause en attendant, relance-le une fois fait.)`,
      })
    } else {
      const { count } = await supabase.from('project_tasks').select('id', { count: 'exact', head: true }).eq('project_id', project.id).in('status', ['pending', 'in_progress'])
      if (count === 0) {
        // Plus rien en attente : le Manager évalue si le projet est vraiment fini ou s'il faut continuer
        try {
          const ctx = await buildContext(project.id)
          const MANAGER = LEADERSHIP.find(a => a.id === 'manager')
          const evaluation = await askAgent(
            MANAGER.engine,
            `Tu es ${MANAGER.name}, le Manager de G-Tech HQ. ${ctx.orgText}\n\n${ctx.teamText}\n\n${ctx.realityFor(MANAGER.id)}\n\nToutes les tâches prévues pour "${project.name}" sont terminées. Le projet est-il vraiment propre et fini — c'est-à-dire une VRAIE application qui peut se lancer (fichiers de config/build présents, squelette cohérent, pas juste des morceaux isolés), avec ses fonctionnalités de base réellement présentes dans les fichiers réels listés — ou reste-t-il du travail concret à faire ? Si des fichiers essentiels manquent pour que ça tourne vraiment (package.json, point d'entrée...), ce n'est PAS fini. Si le projet est vraiment fini, réponds UNIQUEMENT: TERMINE. Sinon, réponds UNIQUEMENT avec 2 à 6 nouvelles tâches concrètes au format (une par ligne, agents réels de l'équipe uniquement) :\nTACHE: <id de l'agent> | <description courte>`,
            'Évalue et décide maintenant.'
          )
          if (/^TERMINE/i.test(evaluation.trim())) {
            await supabase.from('dm_messages').insert({
              agent_id: 'manager', author_id: 'manager',
              content: `Le projet **${project.name}** est terminé et propre selon moi. Tu peux le marquer comme livré si tu es d'accord.`,
            })
          } else {
            const lines = [...evaluation.matchAll(/TACHE:\s*([a-z0-9-]+)\s*\|\s*(.+)/gi)]
            const maxSeq = task.sequence || 0
            const newTasks = lines.map((m, i) => ({ project_id: project.id, agent_id: m[1].trim(), description: m[2].trim(), sequence: maxSeq + 1 + i }))
            if (newTasks.length > 0) {
              await supabase.from('project_tasks').insert(newTasks)
              await supabase.from('activity_log').insert({ project_id: project.id, label: `${MANAGER.name} a ajouté ${newTasks.length} tâche(s) pour continuer le projet` })
            } else {
              await supabase.from('dm_messages').insert({
                agent_id: 'manager', author_id: 'manager',
                content: `J'ai fini le lot de tâches sur **${project.name}** mais je n'arrive pas à déterminer clairement la suite. Peux-tu regarder où ça en est ?`,
              })
            }
          }
        } catch (e) {}
      }
    }

    return res.status(200).json({ done: false, taskId: task.id, agent: agent.name })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
