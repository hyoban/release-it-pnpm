import nextra from 'nextra'

const withNextra = nextra({})

export default withNextra({
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
})
