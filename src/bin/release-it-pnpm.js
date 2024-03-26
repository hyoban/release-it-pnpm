#!/usr/bin/env node

import fs from 'node:fs'

import releaseYml from './release.txt'
import releaseConfigJson from './release-it.txt'

if (!fs.existsSync('.github'))
  fs.mkdirSync('.github')

if (!fs.existsSync('.github/workflows'))
  fs.mkdirSync('.github/workflows')

fs.writeFileSync('.github/workflows/release.yml', releaseYml)
fs.writeFileSync('.release-it.json', releaseConfigJson)
