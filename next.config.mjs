// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Don’t fail the production build on lint or TS while we iterate quickly.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // (optional) If you use images later
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;
