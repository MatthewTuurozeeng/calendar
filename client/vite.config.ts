/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Vite opens the browser named in BROWSER; default to Chrome unless overridden.
process.env.BROWSER ??= 'google chrome'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
