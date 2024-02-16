import fs from 'node:fs'
import path from 'node:path'

import conventionalRecommendedBump from 'conventional-recommended-bump'
import fg from 'fast-glob'
import { Plugin } from 'release-it'
import semver from 'semver'
import { shouldSemanticRelease } from 'should-semantic-release'
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
    message: context => `Are you sure you want to publish? (pnpm -r publish --access public --no-git-checks --tag ${context['index'].tag})`,
  },
}

const MANIFEST_PATH = './package.json'
const MANIFEST_LOCK_PATH = './pnpm-lock.yaml'
const MANIFEST_WORKSPACE_PATH = './pnpm-workspace.yaml'

const DEFAULT_TAG = 'latest'

class ReleaseItPnpmPlugin extends Plugin {
  static isEnabled() {
    return hasAccess(MANIFEST_PATH)
      && hasAccess(MANIFEST_LOCK_PATH)
  }

  static disablePlugin() {
    return ['npm', 'version']
  }

  constructor(...args) {
    super(...args)
    this.registerPrompts(prompts)
  }

  getInitialOptions(options, pluginName) {
    return Object.assign({}, options[pluginName], {
      'dry-run': options['dry-run'],
      'preRelease': options.preRelease,
    })
  }

  async init() {
    const rootPkg = readJSON(path.resolve(MANIFEST_PATH))
    const name = rootPkg.name
    this.setContext({ name })

    const updates = []

    if (!rootPkg.private) {
      updates.push({
        entry: MANIFEST_PATH,
        name: rootPkg.name,
        version: rootPkg.version,
        isRoot: true,
      })
    }

    if (hasAccess(MANIFEST_WORKSPACE_PATH)) {
      const content = fs.readFileSync(path.resolve(MANIFEST_WORKSPACE_PATH), 'utf8')
      const workspaceInfo = parse(content)

      const packages = workspaceInfo.packages
      if (!packages || !Array.isArray(packages))
        throw new Error('Invalid pnpm-workspace.yaml: packages field is missing or not an array')

      const entries = fg.globSync(
        packages.map(pkg => `${pkg}${MANIFEST_PATH.slice(1)}`),
        {
          ignore: ['**/node_modules/**'],
        },
      )

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
    }

    this.log.info(`Found ${updates.length} packages to update`)
    this.setContext({ updates })
  }

  getName() {
    return this.getContext('name')
  }

  async bump(newVersion) {
    const { updates } = this.getContext()
    if (updates.length === 0)
      return false

    for (const update of updates) {
      const { entry, name, version } = update

      if (version === newVersion) {
        continue
      }

      this.log.info(`Package ${name} with version ${version} will be bumped to ${newVersion}`)

      if (!this.options['dry-run']) {
        const pkg = fs.readFileSync(entry, 'utf8')
        const updatedPkg = pkg.replace(
          /"version":\s*".*"/,
          `"version": "${newVersion}"`,
        )
        fs.writeFileSync(entry, updatedPkg)
      }
    }

    const tag = this.options.preRelease || DEFAULT_TAG
    this.setContext({ tag })

    await this.step({
      task: async () => {
        await this.exec(`pnpm -r publish --access public --no-git-checks --tag ${tag}`)
      },
      label: 'Publishing packages',
      prompt: 'publish',
    })
  }

  async getRecommendedVersion({ latestVersion, increment, isPreRelease, preReleaseId }) {
    this.debug({ latestVersion, increment, isPreRelease, preReleaseId })
    // we don not respect the increment option, only prerelease related options are respected
    const { version } = this.getContext()
    if (version) {
      this.setContext({ version: null })
    }
    try {
      const result = await conventionalRecommendedBump({
        preset: {
          name: 'conventionalcommits',
          preMajor: this.options.preMajor ?? semver.lt(latestVersion, '1.0.0'),
        },
      })
      this.debug({ result })

      if (
        result.releaseType === 'patch'
        && !await shouldSemanticRelease({ verbose: false })
      ) {
        return null
      }

      let { releaseType } = result
      if (isPreRelease) {
        const type
          = releaseType && !semver.prerelease(latestVersion)
            ? `pre${releaseType}`
            : 'prerelease'
        this.debug({ inc: { latestVersion, type, preReleaseId } })
        return semver.inc(latestVersion, type, preReleaseId)
      }
      else if (releaseType) {
        this.debug({ inc: { latestVersion, releaseType, preReleaseId } })
        return semver.inc(latestVersion, releaseType, preReleaseId)
      }
      else {
        this.debug({ inc: null })
        return null
      }
    }
    catch (err) {
      this.debug({ err })
      throw err
    }
  }

  getIncrementedVersion(options) {
    return this.getRecommendedVersion(options)
  }

  getIncrementedVersionCI(options) {
    return this.getIncrementedVersion(options)
  }

  async publish() {
    await this.exec('npx changelogithub')
  }
}

export default ReleaseItPnpmPlugin
