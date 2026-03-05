import { describe, it, expect, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { DatabaseError } from '../../utils/errors';

// Import fresh instance per test by re-importing the module
// We need to test the singleton, so we import it directly
let dbManager: typeof import('../db').default;

describe('DatabaseManager', () => {
  afterEach(async () => {
    // Disconnect after each test to reset singleton state
    if (dbManager?.isConnected()) {
      dbManager.disconnect();
    }
  });

  it('connects to an in-memory database', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const result = dbManager.connect(':memory:');
    expect(result).toBeDefined();
    expect(dbManager.isConnected()).toBe(true);
  });

  it('returns existing connection on second connect call', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const first = dbManager.connect(':memory:');
    const second = dbManager.connect(':memory:');
    expect(first).toBe(second);
  });

  it('getDb returns the connected database', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    dbManager.connect(':memory:');
    const result = dbManager.getDb();
    expect(result).toBeDefined();
  });

  it('getDb throws DatabaseError when not connected', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    // Ensure disconnected state
    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    expect(() => dbManager.getDb()).toThrow(DatabaseError);
  });

  it('disconnect closes the connection', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    dbManager.connect(':memory:');
    expect(dbManager.isConnected()).toBe(true);
    dbManager.disconnect();
    expect(dbManager.isConnected()).toBe(false);
  });

  it('disconnect is a no-op when not connected', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    expect(() => dbManager.disconnect()).not.toThrow();
  });

  it('creates directory if it does not exist', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    const tmpDir = path.join(os.tmpdir(), `switch-ai-test-${Date.now()}`, 'nested');
    const dbPath = path.join(tmpDir, 'test.db');

    try {
      dbManager.connect(dbPath);
      expect(fs.existsSync(tmpDir)).toBe(true);
      expect(dbManager.isConnected()).toBe(true);
    } finally {
      dbManager.disconnect();
      fs.rmSync(path.dirname(tmpDir), { recursive: true, force: true });
    }
  });

  it('isConnected returns false initially', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    expect(dbManager.isConnected()).toBe(false);
  });

  it('disconnect throws DatabaseError when close fails', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    const conn = dbManager.connect(':memory:');
    const closeSpy = vi.spyOn(conn, 'close').mockImplementation(() => {
      throw new Error('close failed');
    });

    expect(() => dbManager.disconnect()).toThrow(DatabaseError);
    // Restore real close so afterEach can clean up
    closeSpy.mockRestore();
  });

  it('throws DatabaseError when connecting to an invalid path', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    // Pass a directory path as db file - SQLite can't open a directory as a file
    const { default: os } = await import('os');
    expect(() => dbManager.connect(os.tmpdir())).toThrow(DatabaseError);
  });
});
