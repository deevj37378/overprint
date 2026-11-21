// In-memory stand-in for the Devvit redis client (preview harness only).
// Implements the subset of RedisClient that Overprint uses, with the same signatures.

import { previewState, type RedisEntry as Entry } from './state.ts';
import type { SetOptions, ZMember, ZRangeOptions } from '@devvit/redis';

const store = (): Map<string, Entry> => previewState().redis;

const live = (key: string): Entry | undefined => {
  const entry = store().get(key);
  if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store().delete(key);
    return undefined;
  }
  return entry;
};

const hash = (key: string): Map<string, string> => {
  const entry = live(key);
  if (entry?.kind === 'hash') return entry.value;
  const value = new Map<string, string>();
  store().set(key, { kind: 'hash', value, expiresAt: null });
  return value;
};

const zset = (key: string): Map<string, number> => {
  const entry = live(key);
  if (entry?.kind === 'zset') return entry.value;
  const value = new Map<string, number>();
  store().set(key, { kind: 'zset', value, expiresAt: null });
  return value;
};

const bits = (key: string): Map<number, number> => {
  const entry = live(key);
  if (entry?.kind === 'bits') return entry.value;
  const value = new Map<number, number>();
  store().set(key, { kind: 'bits', value, expiresAt: null });
  return value;
};

const sortedMembers = (key: string): { member: string; score: number }[] =>
  [...(live(key)?.kind === 'zset' ? zset(key) : new Map<string, number>())]
    .map(([member, score]) => ({ member, score }))
    .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));

const sliceRange = <T>(items: T[], start: number, stop: number): T[] => {
  const n = items.length;
  const from = start < 0 ? Math.max(n + start, 0) : start;
  const to = stop < 0 ? n + stop : Math.min(stop, n - 1);
  return from > to ? [] : items.slice(from, to + 1);
};

const parseOffset = (offset: number | string, width: number): number => {
  const text = String(offset);
  return text.startsWith('#') ? Number(text.slice(1)) * width : Number(text);
};

export const redis = {
  async get(key: string): Promise<string | undefined> {
    const entry = live(key);
    return entry?.kind === 'string' ? entry.value : undefined;
  },
  async set(key: string, value: string, options?: SetOptions): Promise<string> {
    const exists = live(key) !== undefined;
    if (options?.nx && exists) return '';
    if (options?.xx && !exists) return '';
    store().set(key, {
      kind: 'string',
      value,
      expiresAt: options?.expiration ? options.expiration.getTime() : null,
    });
    return 'OK';
  },
  async del(...keys: string[]): Promise<void> {
    for (const key of keys) store().delete(key);
  },
  async exists(...keys: string[]): Promise<number> {
    return keys.filter((key) => live(key) !== undefined).length;
  },
  async incrBy(key: string, value: number): Promise<number> {
    const entry = live(key);
    const next = (entry?.kind === 'string' ? Number(entry.value) : 0) + value;
    store().set(key, {
      kind: 'string',
      value: String(next),
      expiresAt: entry?.expiresAt ?? null,
    });
    return next;
  },
  async expire(key: string, seconds: number): Promise<void> {
    const entry = live(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
  },
  async mGet(keys: string[]): Promise<(string | null)[]> {
    return keys.map((key) => {
      const entry = live(key);
      return entry?.kind === 'string' ? entry.value : null;
    });
  },
  async hGet(key: string, field: string): Promise<string | undefined> {
    const entry = live(key);
    return entry?.kind === 'hash' ? entry.value.get(field) : undefined;
  },
  async hSet(
    key: string,
    fieldValues: { [field: string]: string }
  ): Promise<number> {
    const h = hash(key);
    let added = 0;
    for (const [field, value] of Object.entries(fieldValues)) {
      if (!h.has(field)) added++;
      h.set(field, value);
    }
    return added;
  },
  async hSetNX(key: string, field: string, value: string): Promise<number> {
    const h = hash(key);
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  },
  async hGetAll(key: string): Promise<Record<string, string>> {
    const entry = live(key);
    return entry?.kind === 'hash' ? Object.fromEntries(entry.value) : {};
  },
  async hIncrBy(key: string, field: string, value: number): Promise<number> {
    const h = hash(key);
    const next = Number(h.get(field) ?? '0') + value;
    h.set(field, String(next));
    return next;
  },
  async hDel(key: string, fields: string[]): Promise<number> {
    const h = hash(key);
    return fields.filter((field) => h.delete(field)).length;
  },
  async hKeys(key: string): Promise<string[]> {
    const entry = live(key);
    return entry?.kind === 'hash' ? [...entry.value.keys()] : [];
  },
  async zAdd(key: string, ...members: ZMember[]): Promise<number> {
    const z = zset(key);
    let added = 0;
    for (const { member, score } of members) {
      if (!z.has(member)) added++;
      z.set(member, score);
    }
    return added;
  },
  async zIncrBy(key: string, member: string, value: number): Promise<number> {
    const z = zset(key);
    const next = (z.get(member) ?? 0) + value;
    z.set(member, next);
    return next;
  },
  async zScore(key: string, member: string): Promise<number | undefined> {
    const entry = live(key);
    return entry?.kind === 'zset' ? entry.value.get(member) : undefined;
  },
  async zRank(key: string, member: string): Promise<number | undefined> {
    const index = sortedMembers(key).findIndex((m) => m.member === member);
    return index < 0 ? undefined : index;
  },
  async zCard(key: string): Promise<number> {
    const entry = live(key);
    return entry?.kind === 'zset' ? entry.value.size : 0;
  },
  async zRem(key: string, members: string[]): Promise<number> {
    const entry = live(key);
    if (entry?.kind !== 'zset') return 0;
    return members.filter((member) => entry.value.delete(member)).length;
  },
  async zRemRangeByScore(
    key: string,
    min: number,
    max: number
  ): Promise<number> {
    const entry = live(key);
    if (entry?.kind !== 'zset') return 0;
    let removed = 0;
    for (const [member, score] of entry.value) {
      if (score >= min && score <= max) {
        entry.value.delete(member);
        removed++;
      }
    }
    return removed;
  },
  async zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: ZRangeOptions
  ): Promise<{ member: string; score: number }[]> {
    let members = sortedMembers(key);
    if (options?.reverse) members = members.reverse();
    if (options?.by === 'score') {
      const lo = Number(start);
      const hi = Number(stop);
      const [min, max] = options.reverse ? [hi, lo] : [lo, hi];
      members = members.filter((m) => m.score >= min && m.score <= max);
      if (options.limit) {
        members = members.slice(
          options.limit.offset,
          options.limit.offset + options.limit.count
        );
      }
      return members;
    }
    return sliceRange(members, Number(start), Number(stop));
  },
  async bitfield(key: string, ...cmds: (string | number)[]): Promise<number[]> {
    const b = bits(key);
    const out: number[] = [];
    for (let i = 0; i < cmds.length;) {
      const op = String(cmds[i]);
      const encoding = String(cmds[i + 1]);
      const width = Number(encoding.slice(1));
      const offset = parseOffset(cmds[i + 2] ?? 0, width);
      const read = () => {
        let value = 0;
        for (let k = 0; k < width; k++)
          value = value * 2 + (b.get(offset + k) ?? 0);
        return value;
      };
      const write = (value: number) => {
        for (let k = 0; k < width; k++) {
          b.set(offset + k, Math.floor(value / 2 ** (width - 1 - k)) % 2);
        }
      };
      if (op === 'get') {
        out.push(read());
        i += 3;
      } else if (op === 'set') {
        out.push(read());
        write(Number(cmds[i + 3]));
        i += 4;
      } else if (op === 'incrBy') {
        const next = read() + Number(cmds[i + 3]);
        write(next);
        out.push(next);
        i += 4;
      } else {
        i += 2; // overflow
      }
    }
    return out;
  },
};
