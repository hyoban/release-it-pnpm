import fs from 'node:fs'
import path from 'node:path'

import fg from 'fast-glob'
import { Plugin } from 'release-it'
import { parse } from 'yaml'

function hasAccess(path) {
  try {
    fs.accessSync(path)
    return true
  }
  catch {
    return false
  }
}

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'))

const prompts = {
  publish: {
    type: 'confirm',
    message: () => 'Are you sure you want to publish? (pnpm -r publish --access public --no-git-checks)',
  },
}

const MANIFEST_PATH = './package.json'
const MANIFEST_LOCK_PATH = './pnpm-lock.yaml'
const MANIFEST_WORKSPACE_PATH = './pnpm-workspace.yaml'

class ReleaseItPnpmPlugin extends Plugin {
  static isEnabled() {
    return hasAccess(MANIFEST_PATH)
      && hasAccess(MANIFEST_LOCK_PATH)
      && hasAccess(MANIFEST_WORKSPACE_PATH)
  }

  static disablePlugin() {
    return 'npm'
  }

  constructor(...args) {
    super(...args)
    this.registerPrompts(prompts)
  }

  getInitialOptions(options, pluginName) {
    return Object.assign({}, options[pluginName], {
      'dry-run': options['dry-run'],
    })
  }

  async init() {
    const rootPkg = readJSON(path.resolve(MANIFEST_PATH))
    const name = rootPkg.name
    this.setContext({ name })

    const content = fs.readFileSync(path.resolve(MANIFEST_WORKSPACE_PATH), 'utf8')
    const workspaceInfo = parse(content)
    const packages = workspaceInfo.packages
    if (!packages || !Array.isArray(packages))
      return false

    const entries = fg.globSync(
      packages.map(pkg => `${pkg}${MANIFEST_PATH.slice(1)}`),
      {
        ignore: ['**/node_modules/**'],
      },
    )

    if (entries.length === 0) {
      return false
    }

    const updates = []

    for (const entry of entries) {
      const {
        name,
        version,
        private: isPrivate,
      } = readJSON(entry)

      if (!name || isPrivate) {
        continue
      }

      updates.push({ entry, name, version })
    }
    this.log.info(`Detected pnpm-workspace.yaml with ${updates.length} packages`)
    this.setContext({ updates })
  }

  getName() {
    return this.getContext('name')
  }

  async bump(newVersion) {
    const { updates } = this.getContext()

    for (const update of updates) {
      const { entry, name, version } = update
      const pkg = readJSON(entry)

      if (version === newVersion) {
        continue
      }

      this.log.info(`Package ${name} with version ${version} will be bumped to ${newVersion}`)
      pkg.version = newVersion
      if (!this.options['dry-run']) {
        fs.writeFileSync(entry, JSON.stringify(pkg, null, 2))
      }
    }

    await this.step({
      task: async () => {
        await this.exec('pnpm -r publish --access public --no-git-checks')
      },
      label: 'Publishing packages',
      prompt: 'publish',
    })
  }
}

export default ReleaseItPnpmPlugin
