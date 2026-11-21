// Idempotent "one daily post per date". The claim key holds either a post id (done) or
// `pending:{ms}` while a post is being created. A pending claim older than the timeout is
// treated as abandoned (the creator crashed), so the next caller may take over.

export const CLAIM_TIMEOUT_MS = 2 * 60_000;

export type ClaimDecision =
  | { action: 'create' }
  | { action: 'exists'; postId: string }
  | { action: 'wait' };

export const pendingClaim = (nowMs: number): string => `pending:${nowMs}`;

export const decideClaim = (
  existing: string | undefined,
  nowMs: number
): ClaimDecision => {
  if (existing === undefined || existing === '') return { action: 'create' };
  if (existing.startsWith('pending:')) {
    const started = Number(existing.slice('pending:'.length));
    if (!Number.isFinite(started) || nowMs - started > CLAIM_TIMEOUT_MS)
      return { action: 'create' };
    return { action: 'wait' };
  }
  return { action: 'exists', postId: existing };
};
