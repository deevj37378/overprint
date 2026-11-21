import './index.css';

import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MeResponse, PuzzleView } from '../shared/api';
import { GamePage } from './game/GamePage';
import { Tutorial } from './game/Tutorial';
import { journeys } from './lib/journeys';
import { usePrefs } from './lib/prefs';
import { kaChunk, thunk, tick } from './lib/sound';
import { HeaderTools } from './ui/HeaderTools';
import { HelpSheet } from './ui/HelpSheet';

export const App = () => {
  const { prefs, adoptServer, update } = usePrefs();
  const [help, setHelp] = useState(false);
  const [replayingTutorial, setReplayingTutorial] = useState(false);

  const onLoaded = useCallback(
    ({ me }: { puzzle: PuzzleView; me: MeResponse }) => {
      adoptServer(me.prefs, me.loggedIn);
      journeys.ready();
    },
    [adoptServer]
  );

  const finishTutorial = (skipped: boolean, done: () => void) => {
    update({ tutorialDone: true });
    journeys.interaction(skipped ? 'tutorial_skip' : 'tutorial_done');
    done();
  };

  const tools = (
    <HeaderTools
      colourBlind={prefs.colourBlind}
      onToggleColourBlind={() => update({ colourBlind: !prefs.colourBlind })}
      onHelp={() => {
        setHelp(true);
        journeys.interaction('hint');
      }}
    />
  );

  return (
    <>
      {replayingTutorial ? (
        <Tutorial
          colourBlind={prefs.colourBlind}
          onDone={() => setReplayingTutorial(false)}
        />
      ) : (
        <GamePage
          colourBlind={prefs.colourBlind}
          headerTools={tools}
          onLoaded={onLoaded}
          {...(prefs.tutorialDone
            ? {}
            : {
                intro: (_loaded: unknown, done: () => void) => (
                  <Tutorial
                    colourBlind={prefs.colourBlind}
                    onDone={(skipped) => finishTutorial(skipped, done)}
                    onCommand={(command) => {
                      if (command.type === 'pick' || command.type === 'rotate')
                        tick();
                    }}
                  />
                ),
              })}
          onCommand={(command, state) => {
            if (command.type === 'pick') {
              tick();
              if (state.startedAt === null) journeys.ensureStarted();
            }
            if (command.type === 'rotate') {
              tick();
              journeys.interaction('rotate');
            }
            if (command.type === 'undo') journeys.interaction('undo');
            if (command.type === 'clear') journeys.interaction('clear');
          }}
          onPressed={(state) => {
            thunk();
            journeys.progress(
              state.placed.length / Math.max(1, state.tray.length)
            );
          }}
          onSolvedLocally={() => {
            setTimeout(kaChunk, 120);
          }}
          onResult={(result) => journeys.end(true, result.score)}
        />
      )}
      {help && (
        <HelpSheet
          colourBlind={prefs.colourBlind}
          onClose={() => setHelp(false)}
          onReplayTutorial={() => setReplayingTutorial(true)}
        />
      )}
    </>
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
