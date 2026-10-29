import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from './app/providers'
import { router } from './app/routes'
import { setUpPwa } from './features/pwa/install'
import { setUpTheme } from './lib/theme'
import './styles/index.css'

setUpTheme()
setUpPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
