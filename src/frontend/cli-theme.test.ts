import { describe, it, expect } from 'vitest';
import {
  colorize,
  bold,
  dim,
  underline,
  severityColor,
  formatSeverity,
  stripAnsi,
  formatBadge,
  formatHeader,
  formatKeyValue,
  formatList,
  formatTable,
} from './cli-theme';
import type { Color, Severity, StatusBadge } from './cli-theme';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

describe('cli-theme', () => {
  describe('colorize', () => {
    it('wraps text with ANSI color codes', () => {
      expect(colorize('hello', 'red')).toBe(`${ESC}31mhello${RESET}`);
      expect(colorize('ok', 'green')).toBe(`${ESC}32mok${RESET}`);
    });

    it('supports all defined colors', () => {
      const colors: Color[] = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'white'];
      for (const color of colors) {
        const result = colorize('x', color);
        expect(result).toContain('x');
        expect(result).toContain(ESC);
        expect(result).toContain(RESET);
      }
    });

    it('handles empty string', () => {
      expect(colorize('', 'red')).toBe(`${ESC}31m${RESET}`);
    });
  });

  describe('bold', () => {
    it('wraps text with bold ANSI code', () => {
      expect(bold('text')).toBe(`${ESC}1mtext${RESET}`);
    });
  });

  describe('dim', () => {
    it('wraps text with dim ANSI code', () => {
      expect(dim('text')).toBe(`${ESC}2mtext${RESET}`);
    });
  });

  describe('underline', () => {
    it('wraps text with underline ANSI code', () => {
      expect(underline('text')).toBe(`${ESC}4mtext${RESET}`);
    });
  });

  describe('severityColor', () => {
    it('maps severity levels to expected colors', () => {
      expect(severityColor('success')).toBe('green');
      expect(severityColor('warning')).toBe('yellow');
      expect(severityColor('error')).toBe('red');
      expect(severityColor('info')).toBe('cyan');
      expect(severityColor('muted')).toBe('gray');
    });
  });

  describe('formatSeverity', () => {
    it('applies correct color for each severity', () => {
      const severities: Severity[] = ['success', 'warning', 'error', 'info', 'muted'];
      for (const sev of severities) {
        const result = formatSeverity('msg', sev);
        expect(result).toContain('msg');
        expect(result).toContain(ESC);
        expect(result).toContain(RESET);
      }
    });

    it('success uses green color code', () => {
      expect(formatSeverity('ok', 'success')).toBe(`${ESC}32mok${RESET}`);
    });

    it('error uses red color code', () => {
      expect(formatSeverity('fail', 'error')).toBe(`${ESC}31mfail${RESET}`);
    });
  });

  describe('stripAnsi', () => {
    it('removes ANSI codes from colored text', () => {
      const colored = colorize('hello', 'red');
      expect(stripAnsi(colored)).toBe('hello');
    });

    it('removes bold codes', () => {
      expect(stripAnsi(bold('text'))).toBe('text');
    });

    it('removes dim codes', () => {
      expect(stripAnsi(dim('text'))).toBe('text');
    });

    it('returns plain text unchanged', () => {
      expect(stripAnsi('plain')).toBe('plain');
    });

    it('handles empty string', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('strips multiple ANSI sequences', () => {
      const mixed = `${ESC}1m${ESC}31mhello${RESET}${RESET}`;
      expect(stripAnsi(mixed)).toBe('hello');
    });
  });

  describe('formatBadge', () => {
    it('wraps label in brackets with severity color', () => {
      const badge: StatusBadge = { label: 'PASS', severity: 'success' };
      const result = formatBadge(badge);
      expect(stripAnsi(result)).toBe('[PASS]');
      expect(result).toContain(ESC);
    });

    it('uses error color for error badges', () => {
      const badge: StatusBadge = { label: 'FAIL', severity: 'error' };
      const result = formatBadge(badge);
      expect(result).toContain(`${ESC}31m`);
      expect(stripAnsi(result)).toBe('[FAIL]');
    });
  });

  describe('formatHeader', () => {
    it('applies bold and underline', () => {
      const result = formatHeader('Title');
      expect(result).toContain('Title');
      expect(result).toContain(`${ESC}1m`);
      expect(result).toContain(`${ESC}4m`);
    });
  });

  describe('formatKeyValue', () => {
    it('formats key with color and value', () => {
      const result = formatKeyValue('Name', 'Test');
      expect(stripAnsi(result)).toBe('Name: Test');
    });

    it('uses custom key color', () => {
      const result = formatKeyValue('Status', 'ok', 'green');
      expect(result).toContain(`${ESC}32m`);
      expect(stripAnsi(result)).toBe('Status: ok');
    });
  });

  describe('formatList', () => {
    it('formats items with default bullet', () => {
      const result = formatList(['one', 'two']);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      expect(stripAnsi(lines[0]!)).toContain('- one');
      expect(stripAnsi(lines[1]!)).toContain('- two');
    });

    it('uses custom bullet', () => {
      const result = formatList(['item'], '*');
      expect(stripAnsi(result)).toContain('* item');
    });

    it('returns empty string for empty array', () => {
      expect(formatList([])).toBe('');
    });
  });

  describe('formatTable', () => {
    it('formats rows into aligned columns', () => {
      const rows = [
        ['Name', 'Status'],
        ['api', 'ok'],
        ['db', 'degraded'],
      ];
      const result = formatTable(rows);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      // columns should be padded to match widest entry
      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Status');
    });

    it('returns empty string for empty rows', () => {
      expect(formatTable([])).toBe('');
    });

    it('respects custom column widths', () => {
      const rows = [['a', 'b']];
      const result = formatTable(rows, { columnWidths: [10, 10] });
      expect(result.length).toBeGreaterThanOrEqual(20);
    });

    it('respects custom separator', () => {
      const rows = [['a', 'b']];
      const result = formatTable(rows, { separator: ' | ' });
      expect(result).toContain(' | ');
    });

    it('handles rows with different column counts', () => {
      const rows = [['a', 'b', 'c'], ['d']];
      const result = formatTable(rows);
      expect(result.split('\n')).toHaveLength(2);
    });
  });
});
