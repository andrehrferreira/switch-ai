import { describe, it, expect } from 'vitest';
import { ValidationError, ConfigError, DatabaseError, ProxyError } from '../errors';

describe('ValidationError', () => {
  it('sets name, code, statusCode, message', () => {
    const err = new ValidationError('bad input', 'field_a');
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
    expect(err.field).toBe('field_a');
  });

  it('works without a field argument', () => {
    const err = new ValidationError('no field');
    expect(err.field).toBeUndefined();
  });

  it('is an instance of Error', () => {
    expect(new ValidationError('x')).toBeInstanceOf(Error);
  });
});

describe('ConfigError', () => {
  it('sets name, code, statusCode, message', () => {
    const err = new ConfigError('bad config');
    expect(err.name).toBe('ConfigError');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('bad config');
  });

  it('is an instance of Error', () => {
    expect(new ConfigError('x')).toBeInstanceOf(Error);
  });
});

describe('DatabaseError', () => {
  it('sets name, code, statusCode, message', () => {
    const err = new DatabaseError('db failed');
    expect(err.name).toBe('DatabaseError');
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('db failed');
  });

  it('is an instance of Error', () => {
    expect(new DatabaseError('x')).toBeInstanceOf(Error);
  });
});

describe('ProxyError', () => {
  it('sets name, code, statusCode, message', () => {
    const err = new ProxyError('proxy failed');
    expect(err.name).toBe('ProxyError');
    expect(err.code).toBe('PROXY_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('proxy failed');
  });

  it('stores optional originalError', () => {
    const original = new Error('root cause');
    const err = new ProxyError('proxy failed', original);
    expect(err.originalError).toBe(original);
  });

  it('is an instance of Error', () => {
    expect(new ProxyError('x')).toBeInstanceOf(Error);
  });
});
