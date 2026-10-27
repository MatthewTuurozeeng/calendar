import { useEffect, useState } from 'react'

// Service worker registration and the "Install app" prompt (README §4.9).

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferredPrompt: InstallPromptEvent | null = null
const installChanges = new EventTarget()

/** Call once at startup, before React renders, so the install event isn't missed. */
export function setUpPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep Chrome's prompt for the Install button in Settings.
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    installChanges.dispatchEvent(new Event('change'))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installChanges.dispatchEvent(new Event('change'))
  })

  // Only in builds: in dev the worker would cache Vite's modules.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker failed:', err))
    })
  }
}

export function isInstalled(): boolean {
  // navigator.standalone is iOS's flag for a Home Screen app.
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => deferredPrompt !== null)

  useEffect(() => {
    const update = () => setCanInstall(deferredPrompt !== null)
    installChanges.addEventListener('change', update)
    return () => installChanges.removeEventListener('change', update)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    setCanInstall(false)
  }

  return { canInstall, install }
}
