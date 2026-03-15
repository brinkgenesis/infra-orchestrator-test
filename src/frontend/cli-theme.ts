/** ANSI escape code helpers for CLI output styling. */

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

export type Color = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'gray' | 'white';
export type Severity = 'success' | 'warning' | 'error' | 'info' | 'muted';

const COLOR_CODES: Record<Color, number> = {
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
  white: 37,
};

const SEVERITY_COLOR: Record<Severity, Color> = {
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'cyan',
  muted: 'gray',
};

export function colorize(text: string, color: Color): string {
  const code = COLOR_CODES[color];
  return `${ESC}${code}m${text}${RESET}`;
}

export function bold(text: string): string {
  return `${ESC}1m${text}${RESET}`;
}

export function dim(text: string): string {
  return `${ESC}2m${text}${RESET}`;
}

export function underline(text: string): string {
  return `${ESC}4m${text}${RESET}`;
}

export function severityColor(severity: Severity): Color {
  return SEVERITY_COLOR[severity];
}

export function formatSeverity(text: string, severity: Severity): string {
  return colorize(text, severityColor(severity));
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[\d+m/g, '');
}

export interface StatusBadge {
  label: string;
  severity: Severity;
}

export function formatBadge(badge: StatusBadge): string {
  const colored = formatSeverity(badge.label, badge.severity);
  return `[${colored}]`;
}

export function formatHeader(title: string): string {
  return bold(underline(title));
}

export function formatKeyValue(key: string, value: string, keyColor: Color = 'cyan'): string {
  return `${colorize(key, keyColor)}: ${value}`;
}

export function formatList(items: string[], bullet = '-'): string {
  return items.map((item) => `  ${dim(bullet)} ${item}`).join('\n');
}

export function formatTable(
  rows: string[][],
  options: { columnWidths?: number[]; separator?: string } = {},
): string {
  const { separator = '  ' } = options;
  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const widths =
    options.columnWidths ??
    Array.from({ length: colCount }, (_, col) =>
      Math.max(...rows.map((r) => (r[col] ?? '').length)),
    );

  return rows
    .map((row) =>
      row
        .map((cell, i) => {
          const w = widths[i] ?? cell.length;
          return cell.padEnd(w);
        })
        .join(separator),
    )
    .join('\n');
}
