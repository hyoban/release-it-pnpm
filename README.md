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
1. Run [changelogithub](https://github.com/antfu/changelogithub) for GitHub release.
   1. You can disable it by setting `disableRelease` to `true` in `.release-it.json`.

## Install

```sh
ni -D release-it release-it-pnpm
```

You can also install it globally

```sh
npm i -g release-it release-it-pnpm
```

The Recommended `.release-it.json` configuration

```json
{
	"plugins": {
		"release-it-pnpm": {}
	},
	"git": {
		"commitMessage": "chore: release ${version}"
	}
}
```

By default, release-it will not add a `v` prefix for the tag name, useless there already is one tag with the `v` prefix. You can explicitly set the `tagName` in `.release-it.json`:

```json
{
	"git": {
		"tagName": "v${version}"
	}
}
```

The Recommended GitHub Action workflow file `.github/workflows/release.yml`:

```yaml
name: Release

permissions:
  contents: write
  id-token: write

on:
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Git config
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Set node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          registry-url: "https://registry.npmjs.org"

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          run_install: |
            - args: [--frozen-lockfile]
            # Add the following line if you install release-it globally
            # - args: [--global, release-it, release-it-pnpm]

      - name: Release
        run: npx release-it --verbose
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
          NPM_CONFIG_PROVENANCE: true
```

If you want to manually decide the next version in CI, try something like this:

```yaml
name: Release

permissions:
  contents: write
  id-token: write

on:
  workflow_dispatch:
    inputs:
      increment:
        required: true
        default: "patch"
        type: choice
        options:
          - major
          - minor
          - patch

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Git config
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Set node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          registry-url: "https://registry.npmjs.org"

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          run_install: |
            - args: [--frozen-lockfile]

      - name: Release
        run: npx release-it ${{ inputs.increment }}
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
          NPM_CONFIG_PROVENANCE: true
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
