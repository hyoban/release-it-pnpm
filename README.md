# release-it-pnpm

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Run release-it with pnpm workspace

## Requirements

- [ ] use pnpm and set [packageManager](https://nodejs.org/api/packages.html#packagemanager) in `package.json` correctly
- [ ] use [conventional commit](https://www.conventionalcommits.org) and you don't care about the version number

## What it does

1. Disable built-in `npm`, `version`, `github` plugins
1. Guard with [should-semantic-release](https://github.com/JoshuaKGoldberg/should-semantic-release)
1. Provide recommended version automatically (code and idea from [conventional-changelog](https://github.com/release-it/conventional-changelog))
   1. support [preMajor](https://github.com/conventional-changelog/conventional-changelog-config-spec/blob/master/versions/2.2.0/README.md#premajor-boolean) option
1. Bump all packages to the new version
1. Run `pnpm -r publish --access public --no-git-checks --tag ${tag}` ([pnpm publish](https://pnpm.io/cli/publish))
1. Run `npx changelogithub` for github release ([changelogithub](https://github.com/antfu/changelogithub))

## Example

`.release-it.json`

```json
{
  "release-it": {
    "plugins": {
      "release-it-pnpm": {}
    },
    "git": {
      "commitMessage": "chore: release v${version}"
    },
    "hooks": {
      "before:init": [
        "pnpm run lint",
        "pnpm run typecheck",
        "pnpm run test --run"
      ]
    }
  }
}
```

`.github/workflows/release.yml`

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
          git config user.name "${GITHUB_ACTOR}"
          git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"

      - name: Install pnpm
        uses: pnpm/action-setup@v3

      - name: Set node
        uses: actions/setup-node@v3
        with:
          node-version: lts/*

      - name: Login to NPM
        run: echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Setup
        run: npm i -g release-it release-it-pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Release
        run: release-it --verbose
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

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
