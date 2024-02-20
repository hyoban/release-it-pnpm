import fs from 'node:fs'
import path from 'node:path'

import conventionalRecommendedBump from 'conventional-recommended-bump'
import fg from 'fast-glob'
import gitSemverTags from 'git-semver-tags'
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
  release: {
    type: 'confirm',
    message: 'Are you sure you want to create a new release on GitHub?',
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
    return ['npm', 'version', 'github']
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
    const { name, version } = readJSON(path.resolve(MANIFEST_PATH))
    this.setContext({ name, latestVersion: version })

    const updates = [{ entry: MANIFEST_PATH, name, version, isRoot: true }]

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
        const { name, version } = readJSON(entry)
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
    this.debug({ increment, latestVersion, isPreRelease, preReleaseId })
    const { version } = this.getContext()
    if (version)
      return version

    if (!await shouldSemanticRelease({ verbose: true }))
      return null

    const { options } = this
    this.debug('conventionalRecommendedBump', { options })
    try {
      const result = await conventionalRecommendedBump({
        preset: {
          name: 'conventionalcommits',
          preMajor: semver.lt(latestVersion, '1.0.0'),
        },
      })
      this.debug({ result })
      let { releaseType } = result
      if (increment) {
        this.log.warn(`The recommended bump is "${releaseType}", but is overridden with "${increment}".`)
        releaseType = increment
      }
      if (increment && semver.valid(increment)) {
        return increment
      }

      if (isPreRelease) {
        const type
          = releaseType && !semver.prerelease(latestVersion)
            ? `pre${releaseType}`
            : 'prerelease'
        this.debug({ inc: { latestVersion, type, preReleaseId } })
        return semver.inc(latestVersion, type, preReleaseId)
      }
      if (releaseType) {
        this.debug({ inc: { latestVersion, releaseType, preReleaseId } })
        return semver.inc(latestVersion, releaseType, preReleaseId)
      }
      this.debug({ inc: null })
      return null
    }
    catch (err) {
      this.debug({ err })
      throw err
    }
  }

  async getIncrementedVersion(options) {
    const tags = await gitSemverTags()
    const latestTagVersion = tags[0]
    const { latestVersion } = this.getContext()
    if (
      typeof latestVersion === 'string'
      && semver.valid(latestVersion)
      && typeof latestTagVersion === 'string'
      && semver.gt(latestVersion, latestTagVersion)
    ) {
      return semver.valid(latestVersion)
    }
    return this.getRecommendedVersion(options)
  }

  getIncrementedVersionCI(options) {
    return this.getIncrementedVersion(options)
  }

  async release() {
    await this.step({
      task: async () => {
        await this.exec('npx changelogithub')
      },
      label: 'Creating release on GitHub (npx changelogithub)',
      prompt: 'release',
    })
  }
}

export default ReleaseItPnpmPlugin
