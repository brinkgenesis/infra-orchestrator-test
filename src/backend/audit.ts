export interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  clientId: string | null;
  ip: string;
  details?: Record<string, unknown>;
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  clientId?: string;
  from?: string;
  to?: string;
}

export interface AuditQueryResult {
  total: number;
  filtered: number;
  entries: ReadonlyArray<AuditEntry>;
}

/** Parses a single JSONL line into an AuditEntry, returning null if invalid. */
export function parseAuditEntry(line: string): AuditEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  if (typeof parsed['timestamp'] !== 'string') return null;
  if (typeof parsed['action'] !== 'string') return null;

  return {
    timestamp: parsed['timestamp'] as string,
    action: parsed['action'] as string,
    userId: typeof parsed['userId'] === 'string' ? (parsed['userId'] as string) : '',
    resource: typeof parsed['resource'] === 'string' ? (parsed['resource'] as string) : '',
    clientId: typeof parsed['clientId'] === 'string' ? (parsed['clientId'] as string) : null,
    ip: typeof parsed['ip'] === 'string' ? (parsed['ip'] as string) : '',
    ...(parsed['details'] != null && typeof parsed['details'] === 'object'
      ? { details: parsed['details'] as Record<string, unknown> }
      : {}),
  };
}

/** Parses a multi-line JSONL string into an array of AuditEntry objects, skipping invalid lines. */
export function parseAuditLog(content: string): AuditEntry[] {
  if (!content.trim()) return [];
  return content
    .split('\n')
    .map(parseAuditEntry)
    .filter((entry): entry is AuditEntry => entry !== null);
}

/** Returns true if the entry matches all specified filter criteria. */
export function matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
  if (filter.userId !== undefined && entry.userId !== filter.userId) return false;
  if (filter.action !== undefined && entry.action !== filter.action) return false;
  if (filter.clientId !== undefined && entry.clientId !== filter.clientId) return false;
  if (filter.from !== undefined && entry.timestamp < filter.from) return false;
  if (filter.to !== undefined && entry.timestamp > filter.to) return false;
  return true;
}

/** Queries an array of audit entries with an optional filter, returning total, filtered count, and matching entries. */
export function queryAuditLog(
  entries: AuditEntry[],
  filter: AuditFilter = {},
): AuditQueryResult {
  const filtered = entries.filter((e) => matchesFilter(e, filter));
  return {
    total: entries.length,
    filtered: filtered.length,
    entries: filtered,
  };
}

/** Returns a sorted array of unique action strings from the given entries. */
export function getUniqueActions(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.action))].sort();
}

/** Returns a sorted array of unique non-empty user IDs from the given entries. */
export function getUniqueUsers(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.userId).filter((id) => id !== ''))].sort();
}

/** Groups entries by their action field into a record of action to entry arrays. */
export function groupByAction(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const groups: Record<string, AuditEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.action]) {
      groups[entry.action] = [];
    }
    groups[entry.action]!.push(entry);
  }
  return groups;
}

/** Creates an in-memory audit store with append, query, and introspection operations. */
export function createAuditStore(initial: AuditEntry[] = []) {
  const entries: AuditEntry[] = [...initial];

  return {
    append(entry: AuditEntry): void {
      entries.push(entry);
    },
    count(): number {
      return entries.length;
    },
    all(): ReadonlyArray<AuditEntry> {
      return [...entries];
    },
    query(filter: AuditFilter = {}): AuditQueryResult {
      return queryAuditLog(entries, filter);
    },
    actions(): string[] {
      return getUniqueActions(entries);
    },
    users(): string[] {
      return getUniqueUsers(entries);
    },
    clear(): void {
      entries.length = 0;
    },
  };
}
