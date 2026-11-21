// Shows exactly what will be posted, as whom, before anything is sent.

import { showToast } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

type Props = {
  text: string;
  username: string;
  onClose: () => void;
  onShared: () => void;
};

export const ShareSheet = ({ text, username, onClose, onShared }: Props) => {
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const post = async () => {
    if (posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await api.share();
      showToast({
        text: res.alreadyShared ? 'Already shared.' : 'Posted to the comments!',
        appearance: 'success',
      });
      onShared();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not post. Nothing was posted.'
      );
      setPosting(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="share-title"
      className="m-auto mb-0 w-full max-w-[560px] rounded-t-2xl bg-paper p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-2xl"
    >
      <div className="paper-grain flex flex-col gap-3 p-4">
        <h2 id="share-title" className="text-[18px] font-extrabold">
          Post this comment as u/{username}?
        </h2>
        <p className="text-[13px] text-muted">
          It goes under the “Share your print here” comment on this post. It
          shows your result and the print, not how you solved it.
        </p>
        <pre className="m-0 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-xl bg-[#fbf8f2] p-3 font-sans text-[14px] leading-snug ring-1 ring-paper-edge">
          {text.replace(/\*\*/g, '').replace(/ {2}\n/g, '\n')}
        </pre>
        {error && (
          <p className="text-[14px] font-semibold text-[#a3195b]">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-12 flex-1 rounded-full border-2 border-ink bg-[#fbf8f2] font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="share-confirm"
            disabled={posting}
            onClick={() => void post()}
            className="min-h-12 flex-[1.4] rounded-full bg-ink font-extrabold text-paper disabled:opacity-60"
          >
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </div>
    </dialog>
  );
};
