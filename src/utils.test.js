import { expect, test } from 'vitest'

import { fixChangelogTag } from './utils'

test('fixChangelogTag', () => {
  expect(fixChangelogTag(`## 4.6.2

### &nbsp;&nbsp;&nbsp;Bug Fixes

- Write changelog locally should run before publish &nbsp;-&nbsp; by **Stephen Zhou** [<samp>(eea16)</samp>](https://github.com/hyoban/release-it-pnpm/commit/eea163c)

##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](https://github.com/hyoban/release-it-pnpm/compare/4.6.1...main)
`)).toEqual(`## 4.6.2

### &nbsp;&nbsp;&nbsp;Bug Fixes

- Write changelog locally should run before publish &nbsp;-&nbsp; by **Stephen Zhou** [<samp>(eea16)</samp>](https://github.com/hyoban/release-it-pnpm/commit/eea163c)

##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](https://github.com/hyoban/release-it-pnpm/compare/4.6.1...4.6.2)
`)
})
