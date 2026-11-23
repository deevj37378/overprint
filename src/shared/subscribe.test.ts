import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subredditUrl, subscribeFailure } from './subscribe.ts';

test('the missing-approval error maps to needs-approval', () => {
  assert.equal(
    subscribeFailure(
      new Error('permission not granted for [SUBSCRIBE_TO_SUBREDDIT]')
    ),
    'needs-approval'
  );
  assert.equal(
    subscribeFailure(
      new Error(
        '7 PERMISSION_DENIED: permission not granted for [SUBSCRIBE_TO_SUBREDDIT]'
      )
    ),
    'needs-approval',
    'with a gRPC status prefix'
  );
  assert.equal(
    subscribeFailure({
      message: 'Permission not granted for [SUBSCRIBE_TO_SUBREDDIT]',
    }),
    'needs-approval',
    'plain error-like objects'
  );
  assert.equal(
    subscribeFailure('permission not granted for [SUBSCRIBE_TO_SUBREDDIT]'),
    'needs-approval'
  );
});

test('other errors stay failures', () => {
  assert.equal(subscribeFailure(new Error('socket hang up')), 'failed');
  assert.equal(subscribeFailure(undefined), 'failed');
  assert.equal(subscribeFailure({ message: 42 }), 'failed');
});

test('subreddit URL', () => {
  assert.equal(
    subredditUrl('overprint_preview'),
    'https://www.reddit.com/r/overprint_preview/'
  );
});
