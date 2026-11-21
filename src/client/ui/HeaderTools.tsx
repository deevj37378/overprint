import { useEffect, useState } from 'react';
import { onSoundChange, setSound, soundOn } from '../lib/sound';
import { HelpIcon, PatternIcon, SoundOffIcon, SoundOnIcon } from './Icons';

type Props = {
  colourBlind: boolean;
  onToggleColourBlind: () => void;
  onHelp: () => void;
};

const toolClass =
  'flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper-deep aria-pressed:bg-ink aria-pressed:text-paper';

export const HeaderTools = ({
  colourBlind,
  onToggleColourBlind,
  onHelp,
}: Props) => {
  const [sound, setSoundState] = useState(soundOn());
  useEffect(() => onSoundChange(setSoundState), []);
  return (
    <div className="-mr-1.5 flex items-center">
      <button
        type="button"
        className={toolClass}
        aria-pressed={colourBlind}
        aria-label="Colour-blind patterns"
        title="Colour-blind patterns"
        onClick={onToggleColourBlind}
      >
        <PatternIcon />
      </button>
      <button
        type="button"
        className={toolClass}
        aria-pressed={sound}
        aria-label={sound ? 'Sound on' : 'Sound off'}
        title={sound ? 'Sound on' : 'Sound off'}
        onClick={() => setSound(!sound)}
      >
        {sound ? <SoundOnIcon /> : <SoundOffIcon />}
      </button>
      <button
        type="button"
        className={toolClass}
        aria-label="How to play"
        title="How to play"
        onClick={onHelp}
      >
        <HelpIcon />
      </button>
    </div>
  );
};
