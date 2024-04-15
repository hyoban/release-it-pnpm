# release-it-pnpm

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

Run [release-it](https://github.com/release-it/release-it) with [pnpm](https://pnpm.io).

## Requirements with workaround

<details><summary>Use pnpm and set <a href="https://nodejs.org/api/packages.html#packagemanager"> packageManager</a> in <code>package.json</code> correctly.</summary><br/>So that GitHub Action can set up pnpm correctly. You can also manually setup the pnpm version in the GitHub Action workflow file.</details>

<details><summary>Use <a href="https://www.conventionalcommits.org"> Conventional Commits</a> and follow <a href="https://semver.org"> Semantic Versioning </a>.</summary><br/>So that it can provide recommended version in CI. It's OK to not follow this rule if you manually decide the next version and disable GitHub release.</details>

## What it does

1. Disable built-in `npm`, `version` plugins.
1. Provide recommended version automatically in CI.
   1. code and idea from [conventional-changelog](https://github.com/release-it/conventional-changelog)
   1. Support [preMajor](https://github.com/conventional-changelog/conventional-changelog-config-spec/blob/master/versions/2.2.0/README.md#premajor-boolean) option.
1. When you are not in CI, it will use [bumpp](https://github.com/antfu/bumpp) for the next version.
1. Bump all packages to the new version.
1. Run `pnpm -r publish --access public --no-git-checks` ([pnpm publish](https://pnpm.io/cli/publish)).
   1. Appendix `--tag {tag}` if it's a pre-release.
1. Run `npx changelogithub` for GitHub release ([changelogithub](https://github.com/antfu/changelogithub)).
   1. You can disable it by setting `disableRelease` to `true` in `.release-it.json`.

## Install

```sh
ni -D release-it release-it-pnpm
```

You can also install it globally

```sh
npm i -g release-it release-it-pnpm
```

Generate the recommended config, it will create or overwrite `.release-it.json` and `.github/workflows/release.yml` files.

Check files content at [.release-it.json](./src/bin/release-it.txt) and [.github/workflows/release.yml](./src/bin/release.txt)

```sh
release-it-pnpm
```

> [!TIP]
> guard with [should-semantic-release](https://github.com/JoshuaKGoldberg/should-semantic-release)

## Usage

Manually decide the next version

```sh
release-it
```

Use recommended version

```sh
release-it --ci
```

Choose a pre-release tag instead of the default `beta`

```sh
release-it --preRelease=alpha
```

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/release-it-pnpm?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/release-it-pnpm
[npm-downloads-src]: https://img.shields.io/npm/dm/release-it-pnpm?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/release-it-pnpm
