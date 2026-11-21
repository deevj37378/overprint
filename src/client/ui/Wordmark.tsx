// "Overprint" set in three riso inks, slightly off-register, multiplied together.

type Props = { className?: string; text?: string };

export const Wordmark = ({ className = '', text = 'Overprint' }: Props) => (
  <span
    className={`relative inline-block font-display font-extrabold leading-none tracking-[-0.03em] ${className}`}
  >
    <span className="sr-only">{text}</span>
    <span
      aria-hidden="true"
      className="relative block text-riso-yellow"
      style={{ transform: 'translate(0.04em, 0.05em)' }}
    >
      {text}
    </span>
    <span
      aria-hidden="true"
      className="absolute inset-0 text-riso-pink mix-blend-multiply"
      style={{ transform: 'translate(0.025em, -0.01em)' }}
    >
      {text}
    </span>
    <span
      aria-hidden="true"
      className="absolute inset-0 text-riso-blue mix-blend-multiply"
    >
      {text}
    </span>
  </span>
);
