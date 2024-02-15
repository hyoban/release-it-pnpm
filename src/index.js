import fs from 'node:fs'
import module from 'node:module'
import path from 'node:path'
import process from 'node:process'

import fg from 'fast-glob'
import { Plugin } from 'release-it'

const require = module.createRequire(import.meta.url)

class ReleaseItPnpmPlugin extends Plugin {
  static disablePlugin() {
    return 'npm'
  }

  bump(newVersion) {
    const cwd = process.cwd()
    const entries = fg.globSync(['**/package.json'], {
      ignore: ['**/node_modules/**'],
    })
    const absPaths = entries.map(entry => path.join(cwd, entry))
    for (const absPath of absPaths) {
      const pkg = require(absPath)
      const version = pkg.version
      const isPrivate = pkg.private
      console.log(`Bumping version in ${absPath} from ${version} to ${newVersion}`)
      if (version && version !== newVersion && !isPrivate) {
        pkg.version = newVersion
        fs.writeFileSync(absPath, JSON.stringify(pkg, null, 2))
      }
    }
  }
}

export default ReleaseItPnpmPlugin
