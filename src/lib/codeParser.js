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
