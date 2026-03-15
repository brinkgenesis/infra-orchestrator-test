/** ANSI escape code prefix. */
const ESC = '\x1b[';

/** ANSI color codes for foreground text. */
export const colors = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,
} as const;

export type ColorName = keyof typeof colors;

/** Wraps text in the given ANSI color, appending a reset sequence. */
export function colorize(text: string, color: ColorName): string {
  if (color === 'reset') return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/** Returns text styled as a success message (green). */
export function success(text: string): string {
  return colorize(text, 'green');
}

/** Returns text styled as a warning message (yellow). */
export function warning(text: string): string {
  return colorize(text, 'yellow');
}

/** Returns text styled as an error message (red + bold). */
export function error(text: string): string {
  return `${colors.bold}${colors.red}${text}${colors.reset}`;
}

/** Returns text styled as informational (cyan). */
export function info(text: string): string {
  return colorize(text, 'cyan');
}

/** Returns text styled as dimmed/muted (gray). */
export function muted(text: string): string {
  return colorize(text, 'gray');
}

/** Returns bold text. */
export function bold(text: string): string {
  return colorize(text, 'bold');
}

/** Strips all ANSI escape sequences from a string. */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Returns the visible length of a string (ignoring ANSI codes). */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelStyles: Record<LogLevel, (msg: string) => string> = {
  debug: (msg) => colorize(msg, 'gray'),
  info: (msg) => colorize(msg, 'cyan'),
  warn: (msg) => colorize(msg, 'yellow'),
  error: (msg) => error(msg),
};

const levelLabels: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

/** Formats a log line with a colored level prefix. */
export function formatLogLine(level: LogLevel, message: string): string {
  const label = levelLabels[level];
  const styledLabel = levelStyles[level](label);
  return `[${styledLabel}] ${message}`;
}

/** Creates a prefixed logger function for a named component. */
export function createComponentLogger(name: string): (level: LogLevel, message: string) => string {
  const tag = colorize(name, 'magenta');
  return (level: LogLevel, message: string) => {
    return `${formatLogLine(level, '')}${tag} ${message}`.replace('] ', `] `);
  };
}

export interface ThemeConfig {
  useColor: boolean;
  prefix: string;
}

const defaultTheme: ThemeConfig = {
  useColor: true,
  prefix: '',
};

/** Creates a themed formatter that conditionally applies color. */
export function createTheme(overrides?: Partial<ThemeConfig>): {
  config: ThemeConfig;
  format: (text: string, color: ColorName) => string;
  formatPrefix: (text: string) => string;
} {
  const config = { ...defaultTheme, ...overrides };
  return {
    config,
    format: (text: string, color: ColorName) =>
      config.useColor ? colorize(text, color) : text,
    formatPrefix: (text: string) =>
      config.prefix ? `${config.prefix} ${text}` : text,
  };
}

/** Formats a horizontal rule for CLI output. */
export function horizontalRule(width = 40, char = '─'): string {
  return muted(char.repeat(width));
}

/** Formats a section header with a horizontal rule. */
export function sectionHeader(title: string, width = 40): string {
  const line = '─'.repeat(Math.max(0, width - visibleLength(title) - 2));
  return `${bold(title)} ${muted(line)}`;
}

/** Formats a key-value pair for display. */
export function kvPair(key: string, value: string): string {
  return `${muted(key + ':')} ${value}`;
}

/** Returns a colored status badge string. */
export function statusBadge(status: 'ok' | 'warn' | 'error' | 'unknown'): string {
  switch (status) {
    case 'ok': return success('● OK');
    case 'warn': return warning('● WARN');
    case 'error': return error('● ERROR');
    case 'unknown': return muted('○ UNKNOWN');
  }
}
