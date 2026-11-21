// Hand-drawn-ish line icons (no icon font, no network).

import type { SVGProps } from 'react';

type IconProps = { className?: string };

const base: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const RotateIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M20 11a8 8 0 1 0-2.4 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const UndoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const ClearIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </svg>
);

export const StampIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 3h6v5l3 3H6l3-3z" />
    <path d="M5 14h14v3H5z" />
    <path d="M4 21h16" />
  </svg>
);

export const HelpIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4" />
    <path d="M12 17.5h.01" />
  </svg>
);

export const SoundOnIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 10v4h4l5 4V6L8 10z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const SoundOffIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 10v4h4l5 4V6L8 10z" />
    <path d="m17 9 5 5M22 9l-5 5" />
  </svg>
);

export const PatternIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
    <circle cx="12" cy="8" r="1" fill="currentColor" />
    <path d="M7 16l4-4M11 17l6-6" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ChevronIcon = ({
  className,
  dir = 'right',
}: IconProps & { dir?: 'left' | 'right' }) => (
  <svg {...base} className={className}>
    <path d={dir === 'right' ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} />
  </svg>
);
