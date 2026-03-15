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
  entries: AuditEntry[];
  total: number;
  filtered: number;
}

/** Parses a single JSONL line into an AuditEntry, returning null if parsing fails. */
export function parseAuditEntry(line: string): AuditEntry | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line);
    if (typeof obj.timestamp !== 'string' || typeof obj.action !== 'string') {
      return null;
    }
    return {
      timestamp: obj.timestamp,
      userId: obj.userId ?? '',
      action: obj.action,
      resource: obj.resource ?? '',
      clientId: obj.clientId ?? null,
      ip: obj.ip ?? '',
      details: obj.details,
    };
  } catch {
    return null;
  }
}

/** Parses a multi-line JSONL string into an array of AuditEntry objects, skipping invalid lines. */
export function parseAuditLog(content: string): AuditEntry[] {
  return content
    .split('\n')
    .map(parseAuditEntry)
    .filter((e): e is AuditEntry => e !== null);
}

/** Returns true if the given audit entry matches all specified filter criteria. */
export function matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
  if (filter.userId && entry.userId !== filter.userId) return false;
  if (filter.action && entry.action !== filter.action) return false;
  if (filter.clientId && entry.clientId !== filter.clientId) return false;
  if (filter.from && entry.timestamp < filter.from) return false;
  if (filter.to && entry.timestamp > filter.to) return false;
  return true;
}

/** Filters audit entries by the given criteria and returns a query result with totals. */
export function queryAuditLog(
  entries: AuditEntry[],
  filter: AuditFilter = {},
): AuditQueryResult {
  const filtered = entries.filter((e) => matchesFilter(e, filter));
  return {
    entries: filtered,
    total: entries.length,
    filtered: filtered.length,
  };
}

/** Returns a sorted list of unique action strings from the given audit entries. */
export function getUniqueActions(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.action))].sort();
}

/** Returns a sorted list of unique user IDs from the given audit entries. */
export function getUniqueUsers(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.userId).filter(Boolean))].sort();
}

/** Groups audit entries by action and returns a map of action to entry arrays. */
export function groupByAction(
  entries: AuditEntry[],
): Record<string, AuditEntry[]> {
  const groups: Record<string, AuditEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.action]) {
      groups[entry.action] = [];
    }
    groups[entry.action]!.push(entry);
  }
  return groups;
}

/** Creates an in-memory audit store with append, query, and summary operations. */
export function createAuditStore(initial: AuditEntry[] = []) {
  const entries: AuditEntry[] = [...initial];

  return {
    append(entry: AuditEntry): void {
      entries.push(entry);
    },

    query(filter: AuditFilter = {}): AuditQueryResult {
      return queryAuditLog(entries, filter);
    },

    count(): number {
      return entries.length;
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

    all(): ReadonlyArray<AuditEntry> {
      return [...entries];
    },
  };
}
