import { Wordmark } from './Wordmark';

export const Inking = ({ text = 'Inking the rollers…' }: { text?: string }) => (
  <main
    className="paper-grain flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper"
    aria-busy="true"
  >
    <div className="relative h-14 w-24" aria-hidden="true">
      {['bg-riso-yellow', 'bg-riso-pink', 'bg-riso-blue'].map((c, i) => (
        <span
          key={c}
          className={`absolute top-1 h-12 w-12 rounded-full ${c} mix-blend-multiply motion-safe:animate-pulse`}
          style={{ left: `${i * 18}px`, animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
    <p className="text-[15px] font-semibold text-muted">{text}</p>
  </main>
);

export const Jammed = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <main className="paper-grain flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
    <Wordmark className="text-4xl" />
    <p className="max-w-[300px] text-[16px] font-semibold">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="min-h-12 rounded-full bg-ink px-6 font-extrabold text-paper active:scale-[0.98]"
      >
        Try again
      </button>
    )}
  </main>
);
