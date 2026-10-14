/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/inscription", destination: "/", permanent: false },
      { source: "/confirmation", destination: "/", permanent: false },
    ];
  },
};
export default nextConfig;
