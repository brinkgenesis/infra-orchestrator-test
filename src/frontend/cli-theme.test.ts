import { describe, it, expect } from 'vitest';
import {
  colors,
  colorize,
  success,
  warning,
  error,
  info,
  muted,
  bold,
  stripAnsi,
  visibleLength,
  formatLogLine,
  createComponentLogger,
  createTheme,
  horizontalRule,
  sectionHeader,
  kvPair,
  statusBadge,
} from './cli-theme';

const ESC = '\x1b[';

describe('cli-theme', () => {
  describe('colors', () => {
    it('defines a reset code', () => {
      expect(colors.reset).toBe(`${ESC}0m`);
    });

    it('defines standard foreground colors', () => {
      expect(colors.red).toBe(`${ESC}31m`);
      expect(colors.green).toBe(`${ESC}32m`);
      expect(colors.yellow).toBe(`${ESC}33m`);
      expect(colors.blue).toBe(`${ESC}34m`);
      expect(colors.cyan).toBe(`${ESC}36m`);
    });

    it('defines style modifiers', () => {
      expect(colors.bold).toBe(`${ESC}1m`);
      expect(colors.dim).toBe(`${ESC}2m`);
    });
  });

  describe('colorize', () => {
    it('wraps text with color and reset codes', () => {
      expect(colorize('hello', 'red')).toBe(`${ESC}31mhello${ESC}0m`);
    });

    it('returns plain text for reset color', () => {
      expect(colorize('hello', 'reset')).toBe('hello');
    });

    it('handles empty strings', () => {
      expect(colorize('', 'green')).toBe(`${ESC}32m${ESC}0m`);
    });
  });

  describe('semantic helpers', () => {
    it('success applies green', () => {
      expect(stripAnsi(success('ok'))).toBe('ok');
      expect(success('ok')).toContain(colors.green);
    });

    it('warning applies yellow', () => {
      expect(stripAnsi(warning('caution'))).toBe('caution');
      expect(warning('caution')).toContain(colors.yellow);
    });

    it('error applies bold + red', () => {
      expect(stripAnsi(error('fail'))).toBe('fail');
      expect(error('fail')).toContain(colors.bold);
      expect(error('fail')).toContain(colors.red);
    });

    it('info applies cyan', () => {
      expect(stripAnsi(info('note'))).toBe('note');
      expect(info('note')).toContain(colors.cyan);
    });

    it('muted applies gray', () => {
      expect(stripAnsi(muted('dim'))).toBe('dim');
      expect(muted('dim')).toContain(colors.gray);
    });

    it('bold applies bold style', () => {
      expect(stripAnsi(bold('strong'))).toBe('strong');
      expect(bold('strong')).toContain(colors.bold);
    });
  });

  describe('stripAnsi', () => {
    it('removes ANSI codes from styled text', () => {
      expect(stripAnsi(colorize('hello', 'red'))).toBe('hello');
    });

    it('returns plain text unchanged', () => {
      expect(stripAnsi('plain')).toBe('plain');
    });

    it('handles multiple ANSI sequences', () => {
      const styled = `${colors.bold}${colors.red}error${colors.reset}`;
      expect(stripAnsi(styled)).toBe('error');
    });

    it('handles empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });

  describe('visibleLength', () => {
    it('returns correct length for styled text', () => {
      expect(visibleLength(colorize('hello', 'red'))).toBe(5);
    });

    it('returns correct length for plain text', () => {
      expect(visibleLength('hello')).toBe(5);
    });

    it('returns 0 for empty string', () => {
      expect(visibleLength('')).toBe(0);
    });
  });

  describe('formatLogLine', () => {
    it('formats debug level', () => {
      const line = formatLogLine('debug', 'test message');
      expect(stripAnsi(line)).toBe('[DBG] test message');
    });

    it('formats info level', () => {
      const line = formatLogLine('info', 'server started');
      expect(stripAnsi(line)).toBe('[INF] server started');
    });

    it('formats warn level', () => {
      const line = formatLogLine('warn', 'slow query');
      expect(stripAnsi(line)).toBe('[WRN] slow query');
    });

    it('formats error level', () => {
      const line = formatLogLine('error', 'connection lost');
      expect(stripAnsi(line)).toBe('[ERR] connection lost');
    });

    it('applies color to the level label', () => {
      const line = formatLogLine('info', 'msg');
      expect(line).toContain(colors.cyan);
    });
  });

  describe('createComponentLogger', () => {
    it('returns a function', () => {
      const log = createComponentLogger('App');
      expect(typeof log).toBe('function');
    });

    it('includes component name in output', () => {
      const log = createComponentLogger('Router');
      const line = log('info', 'route matched');
      expect(stripAnsi(line)).toContain('Router');
      expect(stripAnsi(line)).toContain('route matched');
    });

    it('applies magenta to component name', () => {
      const log = createComponentLogger('DB');
      const line = log('debug', 'query');
      expect(line).toContain(colors.magenta);
    });
  });

  describe('createTheme', () => {
    it('returns a theme with defaults', () => {
      const theme = createTheme();
      expect(theme.config.useColor).toBe(true);
      expect(theme.config.prefix).toBe('');
    });

    it('format applies color when useColor is true', () => {
      const theme = createTheme({ useColor: true });
      const styled = theme.format('text', 'red');
      expect(styled).toContain(colors.red);
    });

    it('format returns plain text when useColor is false', () => {
      const theme = createTheme({ useColor: false });
      const styled = theme.format('text', 'red');
      expect(styled).toBe('text');
    });

    it('formatPrefix prepends prefix when set', () => {
      const theme = createTheme({ prefix: '[APP]' });
      expect(theme.formatPrefix('msg')).toBe('[APP] msg');
    });

    it('formatPrefix returns text unchanged when no prefix', () => {
      const theme = createTheme();
      expect(theme.formatPrefix('msg')).toBe('msg');
    });

    it('accepts partial overrides', () => {
      const theme = createTheme({ prefix: '>' });
      expect(theme.config.useColor).toBe(true);
      expect(theme.config.prefix).toBe('>');
    });
  });

  describe('horizontalRule', () => {
    it('creates a muted horizontal rule of default width', () => {
      const rule = horizontalRule();
      expect(stripAnsi(rule)).toBe('─'.repeat(40));
    });

    it('respects custom width', () => {
      const rule = horizontalRule(10);
      expect(stripAnsi(rule)).toBe('─'.repeat(10));
    });

    it('respects custom character', () => {
      const rule = horizontalRule(5, '=');
      expect(stripAnsi(rule)).toBe('=====');
    });
  });

  describe('sectionHeader', () => {
    it('includes the title in output', () => {
      const header = sectionHeader('Status');
      expect(stripAnsi(header)).toContain('Status');
    });

    it('includes a separator line', () => {
      const header = sectionHeader('Test', 20);
      expect(stripAnsi(header)).toContain('─');
    });
  });

  describe('kvPair', () => {
    it('formats key-value with muted key', () => {
      const pair = kvPair('Port', '3000');
      expect(stripAnsi(pair)).toBe('Port: 3000');
    });

    it('applies muted style to key', () => {
      const pair = kvPair('Host', 'localhost');
      expect(pair).toContain(colors.gray);
    });
  });

  describe('statusBadge', () => {
    it('returns green badge for ok', () => {
      const badge = statusBadge('ok');
      expect(stripAnsi(badge)).toBe('● OK');
      expect(badge).toContain(colors.green);
    });

    it('returns yellow badge for warn', () => {
      const badge = statusBadge('warn');
      expect(stripAnsi(badge)).toBe('● WARN');
      expect(badge).toContain(colors.yellow);
    });

    it('returns red badge for error', () => {
      const badge = statusBadge('error');
      expect(stripAnsi(badge)).toBe('● ERROR');
      expect(badge).toContain(colors.red);
    });

    it('returns muted badge for unknown', () => {
      const badge = statusBadge('unknown');
      expect(stripAnsi(badge)).toBe('○ UNKNOWN');
      expect(badge).toContain(colors.gray);
    });
  });
});
