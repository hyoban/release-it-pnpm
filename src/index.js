import fs from 'node:fs'

import { versionBump } from 'bumpp'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import { Plugin } from 'release-it'
import semver from 'semver'

const prompts = {
  publish: {
    type: 'confirm',
    message: () => 'Are you sure you want to publish? (pnpm -r publish --access public --no-git-checks)',
  },
  release: {
    type: 'confirm',
    message: () => 'Are you sure you want to create a new release on GitHub? (npx changelogithub)',
  },
}

class ReleaseItPnpmPlugin extends Plugin {
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
      'ci': options.ci,
      'preRelease': options.preRelease,
    })
  }

  getIncrementedVersionCI(options) {
    return this.getRecommendedVersion(options)
  }

  async getIncrementedVersion(options) {
    return this.getRecommendedVersion(options)
  }

  async getRecommendedVersion({ latestVersion, increment, isPreRelease, preReleaseId }) {
    this.debug('release-it-pnpm:getRecommendedVersion', { increment, latestVersion, isPreRelease, preReleaseId })
    const { options } = this
    this.debug('release-it-pnpm:getRecommendedVersion', { options })

    if (!options.ci) {
      const result = await versionBump({
        commit: false,
        tag: false,
        push: false,
        confirm: true,
        preid: preReleaseId,
        files: ['this-is-a-non-existing-file-i-believe-you-do-not-have-it.txt'],
      })
      return semver.valid(result.newVersion)
    }

    try {
      const result = await conventionalRecommendedBump({
        preset: {
          name: 'conventionalcommits',
          preMajor: semver.lt(latestVersion, '1.0.0'),
        },
      })
      this.debug('release-it-pnpm:getRecommendedVersion', { result })
      let { releaseType } = result
      if (increment) {
        this.log.warn(`The recommended bump is "${releaseType}", but is overridden with "${increment}".`)
        releaseType = increment
      }
      if (increment && semver.valid(increment)) {
        return increment
      }
      else if (isPreRelease) {
        const type
          = releaseType && !semver.prerelease(latestVersion)
            ? `pre${releaseType}`
            : 'prerelease'
        return semver.inc(latestVersion, type, preReleaseId)
      }
      else if (!releaseType) {
        return null
      }
      return semver.inc(latestVersion, releaseType, preReleaseId)
    }
    catch (err) {
      this.debug('release-it-pnpm:getRecommendedVersion', { err })
      throw err
    }
  }

  async bump(newVersion) {
    let needPublish = false

    if (!this.options['dry-run']) {
      const { updatedFiles } = await versionBump({
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        recursive: true,
        release: newVersion,
      })
      if (updatedFiles.length > 0) {
        for (const file of updatedFiles) {
          const { private: isPrivate } = JSON.parse(fs.readFileSync(file, 'utf8'))
          if (!isPrivate) {
            needPublish = true
            break
          }
        }
      }
    }

    this.debug('release-it-pnpm:bump', { newVersion, parsed: semver.parse(newVersion) })
    const { prerelease } = semver.parse(newVersion)
    const includePrerelease = prerelease.length > 0
    const prereleaseTag = includePrerelease ? `--tag ${prerelease[0]}` : ''
    this.setContext({ prereleaseTag })

    this.debug('release-it-pnpm:bump', { prereleaseTag, needPublish })
    if (needPublish) {
      await this.step({
        task: async () => {
          await this.exec(`pnpm -r publish --access public --no-git-checks ${prereleaseTag}`)
        },
        label: 'Publishing packages(s) (pnpm -r publish --access public --no-git-checks)',
        prompt: 'publish',
      })
    }
  }

  async release() {
    if (this.options?.disableRelease)
      return

    try {
      await this.step({
        task: () => this.exec('npx changelogithub'),
        label: 'Creating release on GitHub (npx changelogithub)',
        prompt: 'release',
      })
    }
    catch (err) {
      this.log.warn(`Failed to create release on GitHub: ${err.message}`)
    }
  }
}

export default ReleaseItPnpmPlugin
