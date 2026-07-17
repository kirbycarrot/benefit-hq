import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native (.node) binary — bundling it breaks the
  // Turbopack production build, so it must be required at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
