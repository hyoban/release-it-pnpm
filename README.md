# release-it-pnpm

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Run [release-it](https://github.com/release-it/release-it) with [pnpm](https://pnpm.io).

## Install

```sh
ni -D release-it release-it-pnpm
```

Generate the recommended config, it will create or overwrite `.release-it.json` and `.github/workflows/release.yml` (guard with [should-semantic-release](https://github.com/JoshuaKGoldberg/should-semantic-release)) files.

```sh
npx release-it-pnpm
```

## Usage

Manually decide the next version

```sh
npx release-it
```

Use recommended version

```sh
npx release-it --ci
```

Choose a pre-release tag instead of the default `beta`

```sh
npx release-it --preRelease=alpha
```

## Requirements

- [ ] use pnpm and set [packageManager](https://nodejs.org/api/packages.html#packagemanager) in `package.json` correctly
- [ ] use [Conventional Commits](https://www.conventionalcommits.org) and follow [Semantic Versioning](https://semver.org)
- [ ] prefer to add a `v` prefix to the tag name (e.g. `v1.2.3`)

## What it does

1. Disable built-in `npm`, `version`, `github` plugins
1. Provide recommended version automatically (code and idea from [conventional-changelog](https://github.com/release-it/conventional-changelog))
   1. support [preMajor](https://github.com/conventional-changelog/conventional-changelog-config-spec/blob/master/versions/2.2.0/README.md#premajor-boolean) option
1. When you are not in CI, it will use [bumpp](https://github.com/antfu/bumpp) for the next version
1. Bump all packages to the new version
1. Run `pnpm -r publish --access public --no-git-checks` ([pnpm publish](https://pnpm.io/cli/publish))
   1. appendix `--tag {tag}` if it's a prerelease
1. Run `npx changelogithub` for GitHub release ([changelogithub](https://github.com/antfu/changelogithub))

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/release-it-pnpm?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/release-it-pnpm
[npm-downloads-src]: https://img.shields.io/npm/dm/release-it-pnpm?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/release-it-pnpm
[bundle-src]: https://img.shields.io/bundlephobia/minzip/release-it-pnpm?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=release-it-pnpm
[license-src]: https://img.shields.io/github/license/hyoban/release-it-pnpm.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/hyoban/release-it-pnpm/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/release-it-pnpm
