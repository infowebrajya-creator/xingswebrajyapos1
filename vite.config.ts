import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Use './' ONLY when explicitly building for Electron desktop packaging.
  // For Web (Vercel, browsers, HTTP servers), base MUST be '/' so nested routes like /admin/pos resolve assets correctly.
  const isElectronBuild = !process.env.VERCEL && (
    process.env.BUILD_TARGET === 'electron' || 
    process.env.ELECTRON_BUILD === 'true' ||
    Boolean(process.env.npm_lifecycle_event && process.env.npm_lifecycle_event.includes('electron'))
  );

  return {
    base: isElectronBuild ? './' : '/',
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
