/** Byte unit labels in ascending order of magnitude. */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Formats a byte count into a human-readable string (e.g. "1.5 MB").
 * Uses base-1024 (binary) units.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${BYTE_UNITS[i]}`;
}

/**
 * Formats a number as a percentage string (e.g. 0.856 -> "85.60%").
 * Accepts a ratio (0–1) by default. Set `isRatio: false` for raw percentages.
 */
export function formatPercentage(
  value: number,
  options: { decimals?: number; isRatio?: boolean } = {},
): string {
  const { decimals = 2, isRatio = true } = options;
  if (!Number.isFinite(value)) return '0.00%';
  const pct = isRatio ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Truncates text to a maximum length, appending an ellipsis if truncated.
 */
export function truncateText(text: string, maxLength: number, ellipsis = '…'): string {
  if (maxLength < 0) return '';
  if (text.length <= maxLength) return text;
  const end = Math.max(0, maxLength - ellipsis.length);
  return text.slice(0, end) + ellipsis;
}

/**
 * Pads a string to align in a fixed-width column, supporting left/right alignment.
 */
export function padColumn(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (text.length >= width) return text.slice(0, width);
  return align === 'left' ? text.padEnd(width) : text.padStart(width);
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * Picks the most appropriate unit (ms, s, min, h).
 */
export function formatDuration(ms: number, decimals = 1): string {
  if (!Number.isFinite(ms) || ms < 0) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(decimals)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(decimals)} min`;
  return `${(ms / 3_600_000).toFixed(decimals)} h`;
}

/**
 * Formats a key-value pair for CLI status output (e.g. "  Memory:  1.50 GB").
 */
export function formatStatusLine(label: string, value: string, labelWidth = 12): string {
  return `  ${padColumn(label + ':', labelWidth, 'left')} ${value}`;
}
