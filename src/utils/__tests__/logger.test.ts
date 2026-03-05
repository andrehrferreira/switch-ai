import { describe, it, expect, vi, beforeEach } from 'vitest';
import logger from '../logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('logs debug when level is debug', () => {
    logger.setLevel('debug');
    logger.debug('test msg', { key: 'val' });
    expect(console.log).toHaveBeenCalled();
    const output = JSON.parse((console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]);
    expect(output.level).toBe('debug');
    expect(output.message).toBe('test msg');
    expect(output.key).toBe('val');
  });

  it('suppresses debug when level is info', () => {
    logger.setLevel('info');
    logger.debug('should not appear');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs info when level is info', () => {
    logger.setLevel('info');
    logger.info('info msg');
    expect(console.log).toHaveBeenCalled();
    const output = JSON.parse((console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]);
    expect(output.level).toBe('info');
  });

  it('suppresses info when level is warn', () => {
    logger.setLevel('warn');
    logger.info('should not appear');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs warn via console.error', () => {
    logger.setLevel('warn');
    logger.warn('warn msg');
    expect(console.error).toHaveBeenCalled();
    const output = JSON.parse((console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0]);
    expect(output.level).toBe('warn');
  });

  it('logs error via console.error', () => {
    logger.setLevel('error');
    logger.error('error msg', { code: 42 });
    expect(console.error).toHaveBeenCalled();
    const output = JSON.parse((console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.code).toBe(42);
  });

  it('suppresses warn when level is error', () => {
    logger.setLevel('error');
    logger.warn('should not appear');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('includes timestamp in every log entry', () => {
    logger.setLevel('debug');
    logger.info('ts test');
    const output = JSON.parse((console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]);
    expect(output.timestamp).toBeDefined();
    expect(new Date(output.timestamp).getTime()).not.toBeNaN();
  });
});
