import { describe, it, expect } from 'vitest';
import {
  parseAuditEntry,
  parseAuditLog,
  matchesFilter,
  queryAuditLog,
  getUniqueActions,
  getUniqueUsers,
  groupByAction,
  createAuditStore,
} from './audit';
import type { AuditEntry, AuditFilter } from './audit';

const sampleEntry: AuditEntry = {
  timestamp: '2026-01-15T10:00:00Z',
  userId: 'user-1',
  action: 'login',
  resource: '/auth',
  clientId: 'client-a',
  ip: '192.168.1.1',
};

const sampleEntry2: AuditEntry = {
  timestamp: '2026-01-15T11:00:00Z',
  userId: 'user-2',
  action: 'logout',
  resource: '/auth',
  clientId: 'client-b',
  ip: '10.0.0.1',
};

const sampleEntry3: AuditEntry = {
  timestamp: '2026-01-15T12:00:00Z',
  userId: 'user-1',
  action: 'update',
  resource: '/profile',
  clientId: null,
  ip: '192.168.1.1',
  details: { field: 'email' },
};

describe('parseAuditEntry', () => {
  it('parses a valid JSONL line', () => {
    const line = JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', action: 'login', userId: 'u1', resource: '/auth', clientId: 'c1', ip: '1.2.3.4' });
    const entry = parseAuditEntry(line);
    expect(entry).not.toBeNull();
    expect(entry!.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(entry!.action).toBe('login');
    expect(entry!.userId).toBe('u1');
  });

  it('returns null for empty line', () => {
    expect(parseAuditEntry('')).toBeNull();
    expect(parseAuditEntry('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseAuditEntry('not json')).toBeNull();
  });

  it('returns null when timestamp is missing', () => {
    expect(parseAuditEntry(JSON.stringify({ action: 'login' }))).toBeNull();
  });

  it('returns null when action is missing', () => {
    expect(parseAuditEntry(JSON.stringify({ timestamp: '2026-01-01T00:00:00Z' }))).toBeNull();
  });

  it('defaults optional fields', () => {
    const line = JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', action: 'test' });
    const entry = parseAuditEntry(line);
    expect(entry).not.toBeNull();
    expect(entry!.userId).toBe('');
    expect(entry!.resource).toBe('');
    expect(entry!.clientId).toBeNull();
    expect(entry!.ip).toBe('');
  });

  it('includes details when present', () => {
    const line = JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', action: 'update', details: { key: 'val' } });
    const entry = parseAuditEntry(line);
    expect(entry!.details).toEqual({ key: 'val' });
  });
});

describe('parseAuditLog', () => {
  it('parses multiple JSONL lines', () => {
    const content = [
      JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', action: 'login' }),
      JSON.stringify({ timestamp: '2026-01-01T01:00:00Z', action: 'logout' }),
    ].join('\n');
    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(2);
  });

  it('skips invalid lines', () => {
    const content = [
      JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', action: 'login' }),
      'invalid line',
      '',
      JSON.stringify({ timestamp: '2026-01-01T01:00:00Z', action: 'logout' }),
    ].join('\n');
    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(2);
  });

  it('returns empty array for empty content', () => {
    expect(parseAuditLog('')).toEqual([]);
  });
});

describe('matchesFilter', () => {
  it('matches with empty filter', () => {
    expect(matchesFilter(sampleEntry, {})).toBe(true);
  });

  it('filters by userId', () => {
    expect(matchesFilter(sampleEntry, { userId: 'user-1' })).toBe(true);
    expect(matchesFilter(sampleEntry, { userId: 'user-2' })).toBe(false);
  });

  it('filters by action', () => {
    expect(matchesFilter(sampleEntry, { action: 'login' })).toBe(true);
    expect(matchesFilter(sampleEntry, { action: 'logout' })).toBe(false);
  });

  it('filters by clientId', () => {
    expect(matchesFilter(sampleEntry, { clientId: 'client-a' })).toBe(true);
    expect(matchesFilter(sampleEntry, { clientId: 'client-b' })).toBe(false);
  });

  it('filters by from timestamp', () => {
    expect(matchesFilter(sampleEntry, { from: '2026-01-15T09:00:00Z' })).toBe(true);
    expect(matchesFilter(sampleEntry, { from: '2026-01-15T11:00:00Z' })).toBe(false);
  });

  it('filters by to timestamp', () => {
    expect(matchesFilter(sampleEntry, { to: '2026-01-15T11:00:00Z' })).toBe(true);
    expect(matchesFilter(sampleEntry, { to: '2026-01-15T09:00:00Z' })).toBe(false);
  });

  it('combines multiple filter criteria', () => {
    const filter: AuditFilter = { userId: 'user-1', action: 'login' };
    expect(matchesFilter(sampleEntry, filter)).toBe(true);
    expect(matchesFilter(sampleEntry2, filter)).toBe(false);
  });
});

describe('queryAuditLog', () => {
  const entries = [sampleEntry, sampleEntry2, sampleEntry3];

  it('returns all entries with empty filter', () => {
    const result = queryAuditLog(entries);
    expect(result.total).toBe(3);
    expect(result.filtered).toBe(3);
    expect(result.entries).toHaveLength(3);
  });

  it('filters entries by userId', () => {
    const result = queryAuditLog(entries, { userId: 'user-1' });
    expect(result.total).toBe(3);
    expect(result.filtered).toBe(2);
  });

  it('filters entries by action', () => {
    const result = queryAuditLog(entries, { action: 'logout' });
    expect(result.filtered).toBe(1);
    expect(result.entries[0]!.userId).toBe('user-2');
  });

  it('returns empty when no entries match', () => {
    const result = queryAuditLog(entries, { action: 'delete' });
    expect(result.filtered).toBe(0);
    expect(result.entries).toEqual([]);
  });
});

describe('getUniqueActions', () => {
  it('returns sorted unique actions', () => {
    const entries = [sampleEntry, sampleEntry2, sampleEntry3];
    expect(getUniqueActions(entries)).toEqual(['login', 'logout', 'update']);
  });

  it('returns empty array for empty entries', () => {
    expect(getUniqueActions([])).toEqual([]);
  });
});

describe('getUniqueUsers', () => {
  it('returns sorted unique user IDs', () => {
    const entries = [sampleEntry, sampleEntry2, sampleEntry3];
    expect(getUniqueUsers(entries)).toEqual(['user-1', 'user-2']);
  });

  it('excludes empty user IDs', () => {
    const entry: AuditEntry = { ...sampleEntry, userId: '' };
    expect(getUniqueUsers([entry])).toEqual([]);
  });

  it('returns empty array for empty entries', () => {
    expect(getUniqueUsers([])).toEqual([]);
  });
});

describe('groupByAction', () => {
  it('groups entries by action', () => {
    const entries = [sampleEntry, sampleEntry2, sampleEntry3];
    const groups = groupByAction(entries);
    expect(Object.keys(groups).sort()).toEqual(['login', 'logout', 'update']);
    expect(groups['login']).toHaveLength(1);
    expect(groups['logout']).toHaveLength(1);
    expect(groups['update']).toHaveLength(1);
  });

  it('groups multiple entries under same action', () => {
    const entries = [sampleEntry, { ...sampleEntry, userId: 'user-3' }];
    const groups = groupByAction(entries);
    expect(groups['login']).toHaveLength(2);
  });

  it('returns empty object for empty entries', () => {
    expect(groupByAction([])).toEqual({});
  });
});

describe('createAuditStore', () => {
  it('starts empty by default', () => {
    const store = createAuditStore();
    expect(store.count()).toBe(0);
    expect(store.all()).toEqual([]);
  });

  it('accepts initial entries', () => {
    const store = createAuditStore([sampleEntry, sampleEntry2]);
    expect(store.count()).toBe(2);
  });

  it('appends entries', () => {
    const store = createAuditStore();
    store.append(sampleEntry);
    expect(store.count()).toBe(1);
    store.append(sampleEntry2);
    expect(store.count()).toBe(2);
  });

  it('queries entries with filter', () => {
    const store = createAuditStore([sampleEntry, sampleEntry2, sampleEntry3]);
    const result = store.query({ userId: 'user-1' });
    expect(result.filtered).toBe(2);
    expect(result.total).toBe(3);
  });

  it('returns unique actions', () => {
    const store = createAuditStore([sampleEntry, sampleEntry2]);
    expect(store.actions()).toEqual(['login', 'logout']);
  });

  it('returns unique users', () => {
    const store = createAuditStore([sampleEntry, sampleEntry2]);
    expect(store.users()).toEqual(['user-1', 'user-2']);
  });

  it('clears all entries', () => {
    const store = createAuditStore([sampleEntry, sampleEntry2]);
    store.clear();
    expect(store.count()).toBe(0);
    expect(store.all()).toEqual([]);
  });

  it('all() returns a copy', () => {
    const store = createAuditStore([sampleEntry]);
    const all = store.all();
    expect(all).toHaveLength(1);
    // Mutating returned array should not affect store
    (all as AuditEntry[]).push(sampleEntry2);
    expect(store.count()).toBe(1);
  });
});
