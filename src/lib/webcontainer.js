import { WebContainer } from '@webcontainer/api'

let containerInstance = null
let bootPromise = null

export function isSupported() {
  return typeof SharedArrayBuffer !== 'undefined'
}

export async function getContainer() {
  if (containerInstance) return containerInstance
  if (!bootPromise) bootPromise = WebContainer.boot()
  containerInstance = await bootPromise
  return containerInstance
}

// Convertit notre liste plate de fichiers (project_files) en arborescence attendue par WebContainer
export function filesToTree(files) {
  const tree = {}
  for (const file of files) {
    const parts = file.path.split('/')
    let node = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]
      node[dir] = node[dir] || { directory: {} }
      node = node[dir].directory
    }
    node[parts[parts.length - 1]] = { file: { contents: file.content } }
  }
  return tree
}

// Lance install + dev, en streamant les logs et en signalant l'URL de preview dès qu'un serveur démarre
export async function runProject(files, { onLog, onServerReady, onExit }) {
  const container = await getContainer()
  await container.mount(filesToTree(files))

  const install = await container.spawn('npm', ['install'])
  install.output.pipeTo(new WritableStream({ write: onLog }))
  const installExit = await install.exit
  if (installExit !== 0) {
    onExit?.(installExit, 'install')
    return
  }

  container.on('server-ready', (port, url) => onServerReady?.(url))

  // On essaie "dev" en priorité (serveurs web), sinon "start", sinon on tente juste "build" pour vérifier que ça compile
  const pkgFile = files.find(f => f.path === 'package.json')
  let scripts = {}
  try { scripts = JSON.parse(pkgFile?.content || '{}').scripts || {} } catch {}

  const command = scripts.dev ? 'dev' : scripts.start ? 'start' : scripts.build ? 'build' : null
  if (!command) {
    onLog?.('Aucun script dev/start/build trouvé dans package.json — impossible de tester automatiquement.')
    return
  }
  const run = await container.spawn('npm', ['run', command])
  run.output.pipeTo(new WritableStream({ write: onLog }))
  const runExit = await run.exit
  onExit?.(runExit, command)
}
