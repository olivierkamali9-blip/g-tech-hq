// Un agent écrit ses fichiers avec ce format exact :
// FICHIER: chemin/du/fichier.ext
// ```langage
// contenu
// ```
// Cette fonction les extrait pour les sauvegarder automatiquement, sans copier-coller.

export function extractFilesFromMessage(text) {
  const files = []
  const regex = /FICHIER:\s*(\S+)\s*\n```[a-zA-Z0-9]*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].replace(/\n$/, '') })
  }
  return files
}

// Filet de sécurité : retire les blocs FICHIER du texte affiché dans le chat,
// même si l'agent a oublié la consigne de ne pas les recopier visiblement.
export function stripFileBlocks(text) {
  const cleaned = text.replace(/FICHIER:\s*\S+\s*\n```[a-zA-Z0-9]*\n[\s\S]*?```/g, '').trim()
  return cleaned || 'C\'est fait — je viens de mettre à jour le projet, tu peux voir le résultat sur GitHub si tu veux jeter un œil.'
}
