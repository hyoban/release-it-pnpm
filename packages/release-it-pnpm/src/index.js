import fs from 'node:fs'
import module from 'node:module'
import path from 'node:path'
import process from 'node:process'

import fg from 'fast-glob'
import { Plugin } from 'release-it'
import { parse } from 'yaml'

const req = module.createRequire(import.meta.url)

const prompts = {
  bump: {
    type: 'confirm',
    message: () => 'Are you sure you want to bump the version for the packages?',
  },
  publish: {
    type: 'confirm',
    message: () => 'Are you sure you want to publish? (pnpm -r publish --access public --no-git-checks)',
  },
}

class ReleaseItPnpmPlugin extends Plugin {
  constructor(...args) {
    super(...args)
    this.registerPrompts(prompts)
  }

  static disablePlugin() {
    return 'npm'
  }

  getInitialOptions(options) {
    return options
  }

  async bump(newVersion) {
    const cwd = process.cwd()
    const pnpmWorkspaces = path.join(cwd, 'pnpm-workspace.yaml')
    this.log.info(`Reading workspace config ${pnpmWorkspaces}`)

    if (!fs.existsSync(pnpmWorkspaces)) {
      this.log.info('No pnpm-workspace.yaml found, skipping pnpm version bump')
      return
    }

    const content = fs.readFileSync(pnpmWorkspaces, 'utf8')
    const workspace = parse(content)
    const packages = workspace.packages
    if (!packages || !Array.isArray(packages)) {
      this.log.warn('No packages found in pnpm-workspace.yaml')
      return
    }

    const entries = fg.globSync(
      packages.map(pkg => `${pkg}/package.json`),
      {
        ignore: ['**/node_modules/**'],
      },
    )
    this.log.info(`Detected pnpm-workspace.yaml with ${entries.length} packages`)

    const absPaths = entries.map(entry => path.join(cwd, entry))
    for (const absPath of absPaths) {
      const pkg = req(absPath)
      const version = pkg.version
      const isPrivate = pkg.private
      const name = pkg.name

      if (!name) {
        this.log.info(`Skipping package without name in ${absPath}`)
        continue
      }

      if (isPrivate) {
        this.log.info(`Skipping private package ${name}`)
        continue
      }

      if (version && version !== newVersion) {
        this.log.info(`Package ${name} with version ${version} will be bumped to ${newVersion}`)
        pkg.version = newVersion
        await this.step({
          task: async () => {
            if (!this.options['dry-run']) {
              fs.writeFileSync(absPath, JSON.stringify(pkg, null, 2))
            }
          },
          label: 'Bumping version',
          prompt: 'bump',
        })
      }
      else {
        this.log.info(`Skipping package ${name} with version ${version}`)
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
