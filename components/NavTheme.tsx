'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// Whether the nav is floating over a dark surface (needs white text) or a light
// surface (needs dark text). Defaults to light-surface (dark text). The /ask
// landing hero sets 'over-dark'; thread/other pages leave it at 'over-light'.
type NavSurface = 'over-light' | 'over-dark'

interface NavThemeCtxValue {
  surface: NavSurface
  setSurface: (s: NavSurface) => void
}

const NavThemeCtx = createContext<NavThemeCtxValue>({
  surface: 'over-light',
  setSurface: () => {},
})

export function NavThemeProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<NavSurface>('over-light')
  return <NavThemeCtx.Provider value={{ surface, setSurface }}>{children}</NavThemeCtx.Provider>
}

export function useNavTheme() {
  return useContext(NavThemeCtx)
}
