// Local preview harness: `npm run preview:local`. Never used by the Devvit build.
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { overprintPreview } from './server/bridge.ts';

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
);

export default defineConfig({
  root,
  publicDir: path.join(root, 'public'),
  plugins: [overprintPreview(), react(), tailwind()],
  resolve: {
    // Swap Devvit's runtime for in-memory fakes (applied before SSR externalisation).
    alias: [
      {
        find: /^@devvit\/web\/server$/,
        replacement: path.join(root, 'preview/server/fake-devvit-server.ts'),
      },
      {
        find: /^@devvit\/analytics\/server\/reddit$/,
        replacement: path.join(root, 'preview/server/fake-analytics-server.ts'),
      },
      {
        find: /^@devvit\/web\/client$/,
        replacement: path.join(root, 'preview/client/fake-devvit-client.ts'),
      },
    ],
  },
  server: { port: 5199, open: false },
  clearScreen: false,
});
