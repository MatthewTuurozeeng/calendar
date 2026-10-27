/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
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
    // Server code under test (Edge Function helpers) has no node_modules of its own.
    alias: {
      rrule: fileURLToPath(new URL('./node_modules/rrule/dist/esm/index.js', import.meta.url)),
      'date-fns-tz': fileURLToPath(new URL('./node_modules/date-fns-tz/dist/esm/index.js', import.meta.url)),
    },
  },
})
