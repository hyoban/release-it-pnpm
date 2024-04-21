import fs from 'node:fs'
import { EOL } from 'node:os'

import { versionBump } from 'bumpp'
import {
  generate,
  hasTagOnGitHub,
  isRepoShallow,
  sendRelease,
} from 'changelogithub'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import { blue, bold, cyan, dim, red, yellow } from 'kolorist'
import { Plugin } from 'release-it'
import semver from 'semver'

const prompts = {
  publish: {
    type: 'confirm',
    message: () => 'Are you sure you want to publish package?',
  },
  release: {
    type: 'confirm',
    message: () => 'Are you sure you want to create a new release on GitHub?',
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
    return Object.assign(
      {},
      options[pluginName],
      {
        'dry-run': options['dry-run'],
        'ci': options.ci,
        'preRelease': options.preRelease,
        'verbose': options.verbose,
      },
    )
  }

  getIncrement(options) {
    return options.increment
  }

  getIncrementedVersionCI(options) {
    return this.getRecommendedVersion(options)
  }

  getIncrementedVersion(options) {
    return this.getRecommendedVersion(options)
  }

  async getRecommendedVersion({
    latestVersion,
    increment,
    isPreRelease,
    preReleaseId,
  }) {
    this.debug(
      'release-it-pnpm:getRecommendedVersion',
      {
        increment,
        latestVersion,
        isPreRelease,
        preReleaseId,
      },
    )
    const { options } = this
    this.debug(
      'release-it-pnpm:getRecommendedVersion',
      { options },
    )

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
      this.debug(
        'release-it-pnpm:getRecommendedVersion',
        { result },
      )
      let { releaseType } = result
      if (increment) {
        this.log.warn(`The recommended bump is "${releaseType}", but is overridden with "${increment}".`)
        releaseType = increment
      }
      if (increment && semver.valid(increment)) {
        return increment
      }
      else if (isPreRelease) {
        const type = releaseType && !semver.prerelease(latestVersion)
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
      this.debug(
        'release-it-pnpm:getRecommendedVersion',
        { err },
      )
      throw err
    }
  }

  async bump(newVersion) {
    this.setContext({ newVersion })
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

    this.debug(
      'release-it-pnpm:bump',
      {
        newVersion,
        parsed: semver.parse(newVersion),
      },
    )

    const { prerelease } = semver.parse(newVersion)
    const includePrerelease = prerelease.length > 0
    const prereleaseTag = includePrerelease ? `--tag ${prerelease[0]}` : ''
    this.setContext({ prereleaseTag })

    this.debug(
      'release-it-pnpm:bump',
      { prereleaseTag, needPublish },
    )

    if (needPublish) {
      await this.step({
        task: () => this.exec(`pnpm -r publish --access public --no-git-checks ${prereleaseTag}`),
        label: 'Publishing packages(s)',
        prompt: 'publish',
      })
    }
  }

  async writeChangelog(changelog, version) {
    const { inFile, header: _header = '# Changelog' } = this.options
    const header = _header.split(/\r\n|\r|\n/g).join(EOL)

    let hasInFile = false
    try {
      fs.accessSync(inFile)
      hasInFile = true
    }
    catch (err) {
      this.debug(err)
    }

    let previousChangelog = ''
    try {
      previousChangelog = await fs.promises.readFile(inFile, 'utf8')
      previousChangelog = previousChangelog.replace(header, '')
    }
    catch (err) {
      this.debug(err)
    }

    fs.writeFileSync(
      inFile,
      `${header + EOL + EOL}## ${version}${changelog ? EOL + EOL + changelog.trim() : ''}${previousChangelog ? EOL + EOL + previousChangelog.trim() : ''}${EOL}`,
    )

    if (!hasInFile)
      await this.exec(`git add ${inFile}`)
  }

  async beforeRelease() {
    const { newVersion } = this.getContext()
    const { inFile } = this.options
    const isDryRun = this.options['dry-run']

    this.log.exec(`Writing changelog to ${inFile}`, isDryRun)

    if (inFile && !isDryRun) {
      const { md } = await generate()
      await this.writeChangelog(md, newVersion)
    }
  }

  async release() {
    if (this.options?.disableRelease)
      return

    await this.step({
      task: async () => {
        let token = process.env.GITHUB_TOKEN
        if (!token) {
          try {
            token = await this.exec('gh auth token')
          }
          catch (e) {
            this.debug('release-it-pnpm:release', e)
          }
        }

        let webUrl = ''

        try {
          const { config, md, commits } = await generate({
            token,
            dry: this.options['dry-run'],
          })
          webUrl = `https://${config.baseUrl}/${config.repo}/releases/new?title=${encodeURIComponent(String(config.name || config.to))}&body=${encodeURIComponent(String(md))}&tag=${encodeURIComponent(String(config.to))}&prerelease=${config.prerelease}`

          this.debug('release-it-pnpm:release', { config, md, commits })

          if (this.options['verbose']) {
            this.log.log(
              cyan(config.from)
              + dim(' -> ')
              + blue(config.to)
              + dim(` (${commits.length} commits)`),
            )
            this.log.log(dim('--------------'))
            this.log.log()
            this.log.log(md.replaceAll('&nbsp;', ''))
            this.log.log()
            this.log.log(dim('--------------'))
          }

          const printWebUrl = () => {
            this.log.log()
            this.log.error(yellow('Using the following link to create it manually:'))
            this.log.error(yellow(webUrl))
            this.log.log()
          }

          if (config.dry) {
            this.log.log(yellow('Dry run. Release skipped.'))
            printWebUrl()
            return
          }

          if (!config.token) {
            this.log.error(red('No GitHub token found, specify it via GITHUB_TOKEN env. Release skipped.'))
            printWebUrl()
            return
          }

          if (!(await hasTagOnGitHub(config.to, config))) {
            this.log.error(yellow(`Current ref "${bold(config.to)}" is not available as tags on GitHub. Release skipped.`))
            process.exitCode = 1
            printWebUrl()
            return
          }

          if (commits.length === 0 && (await isRepoShallow())) {
            this.log.error(yellow('The repo seems to be clone shallowly, which make changelog failed to generate. You might want to specify `fetch-depth: 0` in your CI config.'))
            process.exitCode = 1
            printWebUrl()
            return
          }

          await sendRelease(config, md)
        }
        catch (e) {
          this.log.error(red(String(e)))
          if (e?.stack)
            this.log.error(dim(e.stack?.split('\n').slice(1).join('\n')))

          if (webUrl) {
            this.log.log()
            this.log.error(red('Failed to create the release. Using the following link to create it manually:'))
            this.log.error(yellow(webUrl))
            this.log.log()
          }
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1)
        }
      },
      label: 'Creating release on GitHub',
      prompt: 'release',
    })
  }
}

export default ReleaseItPnpmPlugin
