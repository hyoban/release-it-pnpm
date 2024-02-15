import { factory, runTasks } from 'release-it/test/util/index.js'
import { describe, expect, test } from 'vitest'

import Plugin from './index.js'

const namespace = 'release-it-pnpm'

describe('release-it-pnpm', () => {
  const options = { [namespace]: {} }
  const plugin = factory(Plugin, {
    namespace,
    options,
    container: {
      log: {
        // eslint-disable-next-line no-console
        info: args => console.log(args),
        warn: args => console.warn(args),
        error: args => console.error(args),
      },
    },
  })
  test('should not throw', () => {
    expect(() => runTasks(plugin)).not.toThrow()
  })
})
