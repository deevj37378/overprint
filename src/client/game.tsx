import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const App = () => {
  return (
    <main className="flex flex-col justify-center items-center min-h-screen gap-2 bg-[#F4EFE6] text-[#1F1A17]">
      <h1 className="text-3xl font-bold">Overprint</h1>
      <p className="text-base">The press is warming up.</p>
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
