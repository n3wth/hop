// hop had no toast/snackbar system before this — `ToastViewport` is mounted
// once, at the root (app/layout.tsx), which makes `useToast()` available
// anywhere in the client tree without further setup. Re-exported from here
// so call sites import from hop's own components/ (matching every other
// primitive in this directory) instead of reaching into '@astryxdesign/core'
// directly.
//
// Example:
//   'use client'
//   import { useToast } from '@/components/Toast'
//   const toast = useToast()
//   toast({ body: 'Standing order removed' })
export { useToast, Toast } from '@astryxdesign/core/Toast'
export type {
  ToastProps,
  ToastType,
  ToastPosition,
  ToastOptions,
  ShowToastFn,
} from '@astryxdesign/core/Toast'
