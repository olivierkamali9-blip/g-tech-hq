// Ping léger de chaque moteur pour savoir s'il répond, sans consommer de vrai quota de conversation.

async function pingGemini() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
    }
  )
  return res.ok
}

async function pingGroq() {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VITE_GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  })
  return res.ok
}

async function pingMistral() {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VITE_MISTRAL_API_KEY}` },
    body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  })
  return res.ok
}

async function pingOpenRouter() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VITE_OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: 'openrouter/free', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  })
  return res.ok
}

async function pingXai() {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VITE_XAI_API_KEY}` },
    body: JSON.stringify({ model: 'grok-4-fast', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  })
  return res.ok
}

const CHECKS = { gemini: pingGemini, groq: pingGroq, mistral: pingMistral, openrouter: pingOpenRouter, xai: pingXai }

export default async function handler(req, res) {
  const results = {}
  await Promise.all(
    Object.entries(CHECKS).map(async ([engine, fn]) => {
      try {
        results[engine] = await fn()
      } catch {
        results[engine] = false
      }
    })
  )
  return res.status(200).json(results)
}
