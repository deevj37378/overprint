import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <main className="flex flex-col justify-center items-center min-h-screen gap-6 bg-[#F4EFE6] text-[#1F1A17]">
      <h1 className="text-3xl font-bold">Overprint</h1>
      <button
        type="button"
        className="min-h-11 px-6 rounded-full bg-[#1F1A17] text-[#F4EFE6] font-semibold cursor-pointer"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Play
      </button>
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}
