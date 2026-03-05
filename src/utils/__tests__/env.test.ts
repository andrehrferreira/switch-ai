import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseEnvInt, parseEnvBool, parseEnvString, getEnv } from '../env';

describe('env helpers', () => {
  beforeEach(() => {
    delete process.env['TEST_INT'];
    delete process.env['TEST_BOOL'];
    delete process.env['TEST_STR'];
  });

  afterEach(() => {
    delete process.env['TEST_INT'];
    delete process.env['TEST_BOOL'];
    delete process.env['TEST_STR'];
  });

  describe('parseEnvInt', () => {
    it('returns parsed integer when set', () => {
      process.env['TEST_INT'] = '42';
      expect(parseEnvInt('TEST_INT', 0)).toBe(42);
    });

    it('returns default when not set', () => {
      expect(parseEnvInt('TEST_INT', 99)).toBe(99);
    });

    it('returns default when value is not a number', () => {
      process.env['TEST_INT'] = 'abc';
      expect(parseEnvInt('TEST_INT', 7)).toBe(7);
    });
  });

  describe('parseEnvBool', () => {
    it('returns true when set to "true"', () => {
      process.env['TEST_BOOL'] = 'true';
      expect(parseEnvBool('TEST_BOOL', false)).toBe(true);
    });

    it('returns false when set to "false"', () => {
      process.env['TEST_BOOL'] = 'false';
      expect(parseEnvBool('TEST_BOOL', true)).toBe(false);
    });

    it('returns false for any other string', () => {
      process.env['TEST_BOOL'] = 'yes';
      expect(parseEnvBool('TEST_BOOL', true)).toBe(false);
    });

    it('returns default when not set', () => {
      expect(parseEnvBool('TEST_BOOL', true)).toBe(true);
    });
  });

  describe('parseEnvString', () => {
    it('returns env value when set', () => {
      process.env['TEST_STR'] = 'hello';
      expect(parseEnvString('TEST_STR', 'default')).toBe('hello');
    });

    it('returns default when not set', () => {
      expect(parseEnvString('TEST_STR', 'default')).toBe('default');
    });
  });

  describe('getEnv', () => {
    it('returns value when set', () => {
      process.env['TEST_STR'] = 'value';
      expect(getEnv('TEST_STR')).toBe('value');
    });

    it('returns undefined when not set', () => {
      expect(getEnv('TEST_STR')).toBeUndefined();
    });
  });
});
