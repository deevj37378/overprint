import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAIM_TIMEOUT_MS, decideClaim, pendingClaim } from './claim.ts';
import {
  decodeTarget,
  encodeTarget,
  parsePostData,
  puzzleKey,
  type OverprintPostData,
} from './postdata.ts';
import { dailyPrint } from './daily.ts';
import {
  percentile,
  sanitiseLifts,
  sanitiseTime,
  solveScore,
} from './scoring.ts';

test('daily claim: create, exists, wait, and take over a stale claim', () => {
  const now = 1_000_000;
  assert.deepEqual(decideClaim(undefined, now), { action: 'create' });
  assert.deepEqual(decideClaim('t3_abc', now), {
    action: 'exists',
    postId: 't3_abc',
  });
  assert.deepEqual(decideClaim(pendingClaim(now - 1000), now), {
    action: 'wait',
  });
  assert.deepEqual(decideClaim(pendingClaim(now - CLAIM_TIMEOUT_MS - 1), now), {
    action: 'create',
  });
  assert.deepEqual(decideClaim('pending:garbage', now), { action: 'create' });
});

test('post data round-trips and rejects junk', () => {
  const print = dailyPrint('2026-12-12');
  const target = encodeTarget(print.target);
  assert.equal(target.length, 49);
  assert.deepEqual(decodeTarget(target, 7), print.target);
  const data: OverprintPostData = {
    kind: 'daily',
    date: '2026-12-12',
    number: 12,
    size: 7,
    target,
    title: 'Overprint #12 · Sat 12 Dec',
    maker: null,
    printId: null,
  };
  assert.deepEqual(parsePostData(data), data);
  assert.equal(parsePostData({ ...data, kind: 'other' }), null);
  assert.equal(parsePostData({ ...data, target: '12' }), null);
  assert.equal(
    parsePostData({ ...data, target: target.replace('0', '9') }),
    null
  );
  assert.equal(parsePostData(null), null);
  assert.equal(parsePostData(undefined), null);
  assert.equal(puzzleKey(data), '2026-12-12');
  assert.equal(
    puzzleKey({ kind: 'community', date: '2026-12-12', printId: 'p7' }),
    'print-p7'
  );
});

test('score: time plus 10 s per lift', () => {
  assert.equal(solveScore(42_000, 0), 42_000);
  assert.equal(solveScore(42_000, 2), 62_000);
});

test('times are clamped to what the server saw and to a plausible floor', () => {
  assert.equal(sanitiseTime(30_000, 3, null), 30_000);
  assert.equal(
    sanitiseTime(30_000, 3, 10_000),
    12_000,
    'never longer than server-observed + 2 s'
  );
  assert.equal(
    sanitiseTime(100, 3, null),
    1800,
    'never faster than 600 ms per stamp'
  );
  assert.equal(sanitiseTime(Number.NaN, 3, 5000), 7000);
  assert.equal(sanitiseLifts(-3), 0);
  assert.equal(sanitiseLifts(2.5), 0);
  assert.equal(sanitiseLifts(4), 4);
});

test('percentile: faster than N% of other printers', () => {
  assert.equal(percentile(0, 1), null);
  assert.equal(percentile(0, 5), 100);
  assert.equal(percentile(4, 5), 0);
  assert.equal(percentile(1, 5), 75);
});
