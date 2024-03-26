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

    if (!options.ci && !this.options['dry-run']) {
      const result = await versionBump({
        commit: false,
        tag: false,
        push: false,
        confirm: true,
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
            this.setContext({ needPublish: true })
            break
          }
        }
      }
    }

    this.debug({ newVersion, parsed: semver.parse(newVersion) })
    const { prerelease } = semver.parse(newVersion)
    const includePrerelease = prerelease.length > 0
    const prereleaseTag = includePrerelease ? `--tag ${prerelease[0]}` : ''
    this.setContext({ prereleaseTag })
  }

  async release() {
    const { prereleaseTag, needPublish } = this.getContext()
    if (needPublish) {
      await this.step({
        task: async () => {
          await this.exec(`pnpm -r publish --access public ${prereleaseTag}`)
        },
        label: 'Publishing packages(s) (pnpm -r publish --access public)',
        prompt: 'publish',
      })
    }

    if (this.options?.disableRelease || !process.env.GITHUB_TOKEN)
      return

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
