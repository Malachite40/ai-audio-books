/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/trpc",
    "@workspace/transactional"
  ],
  typedRoutes: true,
}

export default nextConfig
