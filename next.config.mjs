/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export",  // Only enable this when building for Android
  // output: "standalone", // Previous setting for Electron
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip API routes during static export (they won't work in static export anyway)
  // The client code now calls external APIs directly
  images: {
    unoptimized: true,
  },
};

export default nextConfig;




