import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GamePage } from './game/GamePage';

export const App = () => <GamePage colourBlind={false} />;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
