// Connecteurs unifiés vers les 4 moteurs IA gratuits.
// Chaque fonction prend (systemPrompt, messages[]) et retourne le texte de réponse.

const KEYS = {
  gemini: import.meta.env.VITE_GEMINI_API_KEY,
  groq: import.meta.env.VITE_GROQ_API_KEY,
  mistral: import.meta.env.VITE_MISTRAL_API_KEY,
  openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
}

async function callGemini(systemPrompt, messages) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${KEYS.gemini}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Gemini')
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callGroq(systemPrompt, messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEYS.groq}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Groq')
  return data?.choices?.[0]?.message?.content ?? ''
}

async function callMistral(systemPrompt, messages) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEYS.mistral}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur Mistral')
  return data?.choices?.[0]?.message?.content ?? ''
}

async function callOpenRouter(systemPrompt, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEYS.openrouter}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Erreur OpenRouter')
  return data?.choices?.[0]?.message?.content ?? ''
}

const ENGINES = {
  gemini: callGemini,
  groq: callGroq,
  mistral: callMistral,
  openrouter: callOpenRouter,
}

export async function askAgent(engine, systemPrompt, messages) {
  const fn = ENGINES[engine]
  if (!fn) throw new Error(`Moteur inconnu: ${engine}`)
  if (!KEYS[engine]) throw new Error(`Clé API manquante pour ${engine} — vérifie .env.local`)
  return fn(systemPrompt, messages)
}
