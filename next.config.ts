import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

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
  // Baseline security headers on every response. No CSP yet (Next inlines
  // scripts; a nonce rollout is its own change) — these four are the safe,
  // breakage-free floor: no framing (clickjacking of /account//admin), no
  // MIME sniffing, tight referrers, and no powerful browser APIs.
  // (Next 16 headers.md)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// withBotId wires the same-origin proxy rewrites for the BotID challenge
// script. Without it the classifier gets no browser signal and checkBotId()
// flags EVERY real user as a bot in production — the /api/concierge,
// /api/search, and /api/billing/checkout guards then 403 legitimate traffic.
export default withBotId(nextConfig);
