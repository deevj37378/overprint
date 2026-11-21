import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Wordmark } from './ui/Wordmark';

// Placeholder until the Gallery Wall lands (Phase 7).
export const Gallery = () => (
  <main className="paper-grain flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
    <Wordmark className="text-4xl" text="Gallery Wall" />
    <p className="text-[15px] text-muted">
      The wall is being hung. Check back soon.
    </p>
  </main>
);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gallery />
    </StrictMode>
  );
}
