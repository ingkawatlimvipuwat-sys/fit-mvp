/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app never uses next/image, so the /_next/image optimizer endpoint is
  // pure attack surface — Next 14.2 has unpatched advisories against it.
  // Revisit if next/image is ever adopted (and after the Next 15 upgrade).
  images: { unoptimized: true },
};

export default nextConfig;
