// Fonction serveur (Vercel) — le token GitHub reste ici, jamais exposé au navigateur.
// Attend en POST : { repoName, description, files: [{ path, content }] }

const GITHUB_OWNER = 'olivierkamali9-blip'

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      ...options.headers,
    },
  })
  return res
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN manquant côté serveur (Vercel > Settings > Environment Variables)' })
  }

  const { repoName, description, files } = req.body || {}
  if (!repoName || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'repoName et files sont requis' })
  }

  try {
    // 1. Le repo existe-t-il déjà ?
    const checkRes = await gh(`/repos/${GITHUB_OWNER}/${repoName}`)
    if (checkRes.status === 404) {
      const createRes = await gh('/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name: repoName, description: description || '', private: false, auto_init: true }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        return res.status(500).json({ error: `Création du repo échouée : ${err.message}` })
      }
      // laisser GitHub initialiser la branche par défaut avant d'y écrire
      await new Promise(r => setTimeout(r, 1500))
    } else if (!checkRes.ok) {
      const err = await checkRes.json()
      return res.status(500).json({ error: `Vérification du repo échouée : ${err.message}` })
    }

    // 2. Pousser chaque fichier (créer ou mettre à jour)
    const results = []
    for (const file of files) {
      const contentB64 = Buffer.from(file.content, 'utf-8').toString('base64')
      let sha
      const existing = await gh(`/repos/${GITHUB_OWNER}/${repoName}/contents/${encodeURIComponent(file.path)}`)
      if (existing.ok) {
        const data = await existing.json()
        sha = data.sha
      }
      const putRes = await gh(`/repos/${GITHUB_OWNER}/${repoName}/contents/${encodeURIComponent(file.path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: sha ? `Mise à jour : ${file.path}` : `Ajout : ${file.path}`,
          content: contentB64,
          sha,
        }),
      })
      if (!putRes.ok) {
        const err = await putRes.json()
        results.push({ path: file.path, ok: false, error: err.message })
      } else {
        results.push({ path: file.path, ok: true })
      }
    }

    return res.status(200).json({
      repoUrl: `https://github.com/${GITHUB_OWNER}/${repoName}`,
      results,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
