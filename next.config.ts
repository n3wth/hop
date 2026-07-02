import type { NextConfig } from "next";

// Next.js 16 uses Turbopack by default for both `next dev` and `next build` —
// no opt-in config required.
const nextConfig: NextConfig = {
  experimental: {
    // Run client-side route navigations through the View Transitions API so the
    // quiet cross-route fade in app/globals.css (::view-transition-*(root)) — which
    // was authored for exactly this flag — actually fires on in-app <Link> nav
    // instead of only on hard document loads. Opacity-only, reduced-motion-guarded,
    // degrades to an instant swap where unsupported. (Next 16 viewTransition.md)
    viewTransition: true,
    // Tree-shake barrel imports from Phosphor so each `import { X } from
    // '@phosphor-icons/react'` only pulls the icons actually used (faster dev +
    // smaller bundles), while keeping the ergonomic named-import syntax.
    // (Next 16 optimizePackageImports.md)
    optimizePackageImports: ['@phosphor-icons/react'],
  },
};

export default nextConfig;
