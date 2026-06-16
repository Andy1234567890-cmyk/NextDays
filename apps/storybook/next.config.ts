import type { NextConfig } from "next";

// Auth-Proxy vor dem Storybook. Das gebaute Storybook liegt im PRIVATEN Ordner
// protected/sb und wird nur über die geschützte Route /sb ausgeliefert.
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/sb/[[...path]]": ["./protected/**/*"],
  },
};

export default nextConfig;
