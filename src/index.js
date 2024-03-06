import fs from 'node:fs'
import path from 'node:path'

import { versionBump } from 'bumpp'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import fg from 'fast-glob'
import gitSemverTags from 'git-semver-tags'
import { Plugin } from 'release-it'
import semver from 'semver'
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
    message: () => `Are you sure you want to publish? (pnpm -r publish --access public --no-git-checks)`,
  },
  release: {
    type: 'confirm',
    message: () => 'Are you sure you want to create a new release on GitHub?',
  },
}

const MANIFEST_PATH = './package.json'
const MANIFEST_LOCK_PATH = './pnpm-lock.yaml'
const MANIFEST_WORKSPACE_PATH = './pnpm-workspace.yaml'

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
      'ci': options.ci,
      'preRelease': options.preRelease,
    })
  }

  async init() {
    const { name, version, private: isPrivate } = readJSON(path.resolve(MANIFEST_PATH))
    this.setContext({ name, version })

    const updates = [{ entry: MANIFEST_PATH, name, version, isPrivate: !!isPrivate }]

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
        const { name, version, private: isPrivate } = readJSON(entry)
        updates.push({ entry, name, version, isPrivate: !!isPrivate })
      }
    }

    this.log.info(`Found ${updates.length} packages to update`)
    this.setContext({ updates })
  }

  getName() {
    return this.getContext('name')
  }

  getIncrementedVersionCI(options) {
    return this.getRecommendedVersion(options)
  }

  async getIncrementedVersion(options) {
    return this.getRecommendedVersion(options)
  }

  async getRecommendedVersion({ latestVersion, increment, isPreRelease, preReleaseId }) {
    this.debug({ increment, latestVersion, isPreRelease, preReleaseId })
    const { options } = this
    this.debug('conventionalRecommendedBump', { options })

    if (!options.ci) {
      const result = await versionBump()
      return semver.valid(result.newVersion)
    }

    const tags = await gitSemverTags()
    const latestTagVersion = tags[0]
    const { version } = this.getContext()
    if (
      typeof version === 'string'
      && semver.valid(version)
      && semver.gt(version, latestTagVersion ?? '0.0.0')
    )
      return semver.valid(version)

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
      if (increment && semver.valid(increment))
        return increment

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

  async bump(newVersion) {
    const { updates } = this.getContext()
    if (updates.length === 0)
      return false

    for (const update of updates) {
      const { entry, name, version } = update

      if (version === newVersion)
        continue

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

    if (updates.some(update => !update.isPrivate)) {
      await this.step({
        task: async () => {
          await this.exec(`pnpm -r publish --access public --no-git-checks`)
        },
        label: 'Publishing packages',
        prompt: 'publish',
      })
    }
  }

  async release() {
    if (!this.options?.disableRelease) {
      await this.step({
        task: async () => {
          await this.exec('npx changelogithub')
        },
        label: 'Creating release on GitHub (npx changelogithub)',
        prompt: 'release',
      })
    }
  }
}

export default ReleaseItPnpmPlugin
