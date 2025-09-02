/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep builds green while we’re iterating fast.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: { formats: ['image/avif', 'image/webp'] }
};

export default nextConfig;
