export function fixChangelogTag(content) {
  if (typeof content !== 'string') {
    return content
  }
  const tag = content.match(/^## (\S+)$/m).at(1)
  if (!tag) {
    return content
  }
  const replaceRegex = /(\[View changes on GitHub\]\(\S+\.\.\.)main\)$/m
  return content.replace(replaceRegex, `$1${tag})`)
}
