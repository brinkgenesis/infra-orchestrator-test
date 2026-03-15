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
  timestamp: '2026-03-14T10:00:00.000Z',
  userId: 'user-1',
  action: 'login',
  resource: '/auth',
  clientId: 'client-a',
  ip: '10.0.0.1',
};

const sampleEntries: AuditEntry[] = [
  { timestamp: '2026-03-14T10:00:00.000Z', userId: 'user-1', action: 'login', resource: '/auth', clientId: 'client-a', ip: '10.0.0.1' },
  { timestamp: '2026-03-14T11:00:00.000Z', userId: 'user-2', action: 'read', resource: '/api/data', clientId: 'client-b', ip: '10.0.0.2' },
  { timestamp: '2026-03-14T12:00:00.000Z', userId: 'user-1', action: 'write', resource: '/api/data', clientId: null, ip: '10.0.0.1' },
  { timestamp: '2026-03-14T13:00:00.000Z', userId: 'user-3', action: 'login', resource: '/auth', clientId: 'client-a', ip: '10.0.0.3' },
];

describe('parseAuditEntry', () => {
  it('parses a valid JSON line', () => {
    const line = JSON.stringify(sampleEntry);
    const result = parseAuditEntry(line);
    expect(result).toEqual(sampleEntry);
  });

  it('returns null for empty string', () => {
    expect(parseAuditEntry('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseAuditEntry('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseAuditEntry('not json')).toBeNull();
  });

  it('returns null when timestamp is missing', () => {
    expect(parseAuditEntry(JSON.stringify({ action: 'login' }))).toBeNull();
  });

  it('returns null when action is missing', () => {
    expect(parseAuditEntry(JSON.stringify({ timestamp: '2026-01-01' }))).toBeNull();
  });

  it('defaults optional fields', () => {
    const line = JSON.stringify({ timestamp: '2026-01-01', action: 'test' });
    const result = parseAuditEntry(line);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('');
    expect(result!.resource).toBe('');
    expect(result!.clientId).toBeNull();
    expect(result!.ip).toBe('');
  });

  it('includes details when present', () => {
    const line = JSON.stringify({ ...sampleEntry, details: { key: 'value' } });
    const result = parseAuditEntry(line);
    expect(result!.details).toEqual({ key: 'value' });
  });
});

describe('parseAuditLog', () => {
  it('parses multiple lines', () => {
    const content = sampleEntries.map((e) => JSON.stringify(e)).join('\n');
    const result = parseAuditLog(content);
    expect(result).toHaveLength(4);
  });

  it('skips invalid lines', () => {
    const content = [
      JSON.stringify(sampleEntry),
      'bad line',
      '',
      JSON.stringify(sampleEntries[1]),
    ].join('\n');
    const result = parseAuditLog(content);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty string', () => {
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
    expect(matchesFilter(sampleEntry, { action: 'read' })).toBe(false);
  });

  it('filters by clientId', () => {
    expect(matchesFilter(sampleEntry, { clientId: 'client-a' })).toBe(true);
    expect(matchesFilter(sampleEntry, { clientId: 'client-b' })).toBe(false);
  });

  it('filters by from timestamp', () => {
    expect(matchesFilter(sampleEntry, { from: '2026-03-14T09:00:00.000Z' })).toBe(true);
    expect(matchesFilter(sampleEntry, { from: '2026-03-14T11:00:00.000Z' })).toBe(false);
  });

  it('filters by to timestamp', () => {
    expect(matchesFilter(sampleEntry, { to: '2026-03-14T11:00:00.000Z' })).toBe(true);
    expect(matchesFilter(sampleEntry, { to: '2026-03-14T09:00:00.000Z' })).toBe(false);
  });

  it('combines multiple filter criteria', () => {
    const filter: AuditFilter = { userId: 'user-1', action: 'login' };
    expect(matchesFilter(sampleEntry, filter)).toBe(true);
    expect(matchesFilter(sampleEntries[2]!, { userId: 'user-1', action: 'login' })).toBe(false);
  });
});

describe('queryAuditLog', () => {
  it('returns all entries with no filter', () => {
    const result = queryAuditLog(sampleEntries);
    expect(result.entries).toHaveLength(4);
    expect(result.total).toBe(4);
    expect(result.filtered).toBe(4);
  });

  it('filters entries by userId', () => {
    const result = queryAuditLog(sampleEntries, { userId: 'user-1' });
    expect(result.filtered).toBe(2);
    expect(result.total).toBe(4);
  });

  it('filters entries by action', () => {
    const result = queryAuditLog(sampleEntries, { action: 'login' });
    expect(result.filtered).toBe(2);
  });

  it('returns empty when no entries match', () => {
    const result = queryAuditLog(sampleEntries, { userId: 'no-one' });
    expect(result.filtered).toBe(0);
    expect(result.entries).toEqual([]);
  });
});

describe('getUniqueActions', () => {
  it('returns sorted unique actions', () => {
    const actions = getUniqueActions(sampleEntries);
    expect(actions).toEqual(['login', 'read', 'write']);
  });

  it('returns empty array for empty input', () => {
    expect(getUniqueActions([])).toEqual([]);
  });
});

describe('getUniqueUsers', () => {
  it('returns sorted unique user IDs', () => {
    const users = getUniqueUsers(sampleEntries);
    expect(users).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('excludes empty userId strings', () => {
    const entries: AuditEntry[] = [
      { ...sampleEntry, userId: '' },
      { ...sampleEntry, userId: 'user-1' },
    ];
    expect(getUniqueUsers(entries)).toEqual(['user-1']);
  });

  it('returns empty array for empty input', () => {
    expect(getUniqueUsers([])).toEqual([]);
  });
});

describe('groupByAction', () => {
  it('groups entries by action', () => {
    const groups = groupByAction(sampleEntries);
    expect(Object.keys(groups).sort()).toEqual(['login', 'read', 'write']);
    expect(groups['login']).toHaveLength(2);
    expect(groups['read']).toHaveLength(1);
    expect(groups['write']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(groupByAction([])).toEqual({});
  });
});

describe('createAuditStore', () => {
  it('starts empty by default', () => {
    const store = createAuditStore();
    expect(store.count()).toBe(0);
    expect(store.all()).toEqual([]);
  });

  it('initializes with provided entries', () => {
    const store = createAuditStore(sampleEntries);
    expect(store.count()).toBe(4);
  });

  it('appends entries', () => {
    const store = createAuditStore();
    store.append(sampleEntry);
    expect(store.count()).toBe(1);
    expect(store.all()[0]).toEqual(sampleEntry);
  });

  it('queries with filter', () => {
    const store = createAuditStore(sampleEntries);
    const result = store.query({ action: 'login' });
    expect(result.filtered).toBe(2);
    expect(result.total).toBe(4);
  });

  it('returns unique actions', () => {
    const store = createAuditStore(sampleEntries);
    expect(store.actions()).toEqual(['login', 'read', 'write']);
  });

  it('returns unique users', () => {
    const store = createAuditStore(sampleEntries);
    expect(store.users()).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('clears all entries', () => {
    const store = createAuditStore(sampleEntries);
    store.clear();
    expect(store.count()).toBe(0);
    expect(store.all()).toEqual([]);
  });

  it('does not mutate initial array', () => {
    const initial = [sampleEntry];
    const store = createAuditStore(initial);
    store.append(sampleEntries[1]!);
    expect(initial).toHaveLength(1);
    expect(store.count()).toBe(2);
  });
});
