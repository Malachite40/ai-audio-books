/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/trpc"],
  typedRoutes: true,
}

export default nextConfig
