'use client'

// @astryxdesign/core/theme's barrel (theme/index.js) carries a top-level
// 'use client' directive, which — per Next's RSC rules — poisons every
// export from that module, including the framework-agnostic `defineTheme()`
// (a plain data function, no React/DOM). Importing it from a Server
// Component (app/layout.tsx has no 'use client') makes Next hand back an
// unusable client-reference stub instead of the real function, which throws
// at build time ("Attempted to call defineTheme() from the server..."). The
// fix is this file: a dedicated 'use client' boundary that imports Theme,
// hopTheme (which calls defineTheme() at module scope), and ToastViewport
// together, so the whole chain runs as ordinary client code. Same pattern as
// newth-garden's src/app/providers.tsx.
import { Theme } from '@astryxdesign/core/theme'
import { ToastViewport } from '@astryxdesign/core/Toast'
import { hopTheme } from '@/lib/astryx-theme'

export default function AstryxProviders({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={hopTheme} mode="light">
      <ToastViewport position="bottomEnd" maxVisible={3}>
        {children}
      </ToastViewport>
    </Theme>
  )
}
