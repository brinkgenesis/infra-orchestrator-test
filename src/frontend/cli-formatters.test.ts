import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatPercentage,
  truncateText,
  padColumn,
  formatStatusLine,
} from './cli-formatters';

describe('cli-formatters', () => {
  describe('formatBytes', () => {
    it('returns "0 B" for zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes below 1 KB', () => {
      expect(formatBytes(512)).toBe('512.00 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.00 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.00 GB');
    });

    it('respects custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.500 KB');
    });

    it('returns "0 B" for negative values', () => {
      expect(formatBytes(-1)).toBe('0 B');
    });

    it('returns "0 B" for NaN', () => {
      expect(formatBytes(NaN)).toBe('0 B');
    });

    it('returns "0 B" for Infinity', () => {
      expect(formatBytes(Infinity)).toBe('0 B');
    });
  });

  describe('formatPercentage', () => {
    it('formats ratio as percentage by default', () => {
      expect(formatPercentage(0.856)).toBe('85.60%');
    });

    it('formats zero ratio', () => {
      expect(formatPercentage(0)).toBe('0.00%');
    });

    it('formats 100%', () => {
      expect(formatPercentage(1)).toBe('100.00%');
    });

    it('respects custom decimals', () => {
      expect(formatPercentage(0.856, { decimals: 0 })).toBe('86%');
      expect(formatPercentage(0.856, { decimals: 1 })).toBe('85.6%');
    });

    it('handles raw percentage when isRatio is false', () => {
      expect(formatPercentage(85.6, { isRatio: false })).toBe('85.60%');
    });

    it('returns "0.00%" for NaN', () => {
      expect(formatPercentage(NaN)).toBe('0.00%');
    });

    it('returns "0.00%" for Infinity', () => {
      expect(formatPercentage(Infinity)).toBe('0.00%');
    });
  });

  describe('truncateText', () => {
    it('returns text unchanged when within limit', () => {
      expect(truncateText('hello', 10)).toBe('hello');
    });

    it('returns text unchanged when exactly at limit', () => {
      expect(truncateText('hello', 5)).toBe('hello');
    });

    it('truncates with ellipsis when over limit', () => {
      expect(truncateText('hello world', 8)).toBe('hello w…');
    });

    it('supports custom ellipsis', () => {
      expect(truncateText('hello world', 8, '...')).toBe('hello...');
    });

    it('returns empty string for negative maxLength', () => {
      expect(truncateText('hello', -1)).toBe('');
    });

    it('handles empty string', () => {
      expect(truncateText('', 5)).toBe('');
    });
  });

  describe('padColumn', () => {
    it('pads text to width on the right by default (left-align)', () => {
      expect(padColumn('hi', 5)).toBe('hi   ');
    });

    it('pads text to width on the left (right-align)', () => {
      expect(padColumn('hi', 5, 'right')).toBe('   hi');
    });

    it('truncates text that exceeds width', () => {
      expect(padColumn('hello world', 5)).toBe('hello');
    });

    it('returns text unchanged when exactly at width', () => {
      expect(padColumn('hello', 5)).toBe('hello');
    });
  });

  describe('formatStatusLine', () => {
    it('formats a label-value pair with default width', () => {
      const result = formatStatusLine('Memory', '1.50 GB');
      expect(result).toBe('  Memory:      1.50 GB');
    });

    it('respects custom label width', () => {
      const result = formatStatusLine('CPU', '80%', 6);
      expect(result).toBe('  CPU:   80%');
    });
  });
});
