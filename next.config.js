/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};
