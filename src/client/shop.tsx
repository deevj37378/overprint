import './index.css';

import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ShopInfoResponse } from '../shared/api';
import { api } from './lib/api';
import { usePrefs } from './lib/prefs';
import { ShopScreen } from './shop/ShopScreen';
import { HeaderTools } from './ui/HeaderTools';
import { HelpSheet } from './ui/HelpSheet';

export const Shop = () => {
  const { prefs, update } = usePrefs();
  const [info, setInfo] = useState<ShopInfoResponse | null>(null);
  const [help, setHelp] = useState(false);
  const refresh = useCallback(() => {
    api
      .shopInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <>
      <ShopScreen
        info={info}
        colourBlind={prefs.colourBlind}
        onPosted={refresh}
        headerTools={
          <HeaderTools
            colourBlind={prefs.colourBlind}
            onToggleColourBlind={() =>
              update({ colourBlind: !prefs.colourBlind })
            }
            onHelp={() => setHelp(true)}
          />
        }
      />
      {help && (
        <HelpSheet
          colourBlind={prefs.colourBlind}
          onClose={() => setHelp(false)}
        />
      )}
    </>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Shop />
    </StrictMode>
  );
}
