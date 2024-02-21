#!/usr/bin/env node

import fs from 'node:fs'

import releaseYml from './release.txt'
import releaseConfigJson from './release-it.txt'

// write release.yml to `.github/workflows/release.yml`
fs.writeFileSync('.github/workflows/release.yml', releaseYml)
// write .release-it.json to `.release-it.json`
fs.writeFileSync('.release-it.json', releaseConfigJson)
