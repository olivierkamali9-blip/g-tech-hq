// Garde toujours le tout premier message (souvent l'ordre du jour / le cadrage initial)
// en plus des messages les plus récents, pour qu'une longue discussion ne perde jamais son point de départ.
export function buildAnchoredHistory(allMessages, cap = 20) {
  if (allMessages.length <= cap) return allMessages
  const [first, ...rest] = allMessages
  return [first, ...rest.slice(-(cap - 1))]
}
