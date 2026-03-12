import { describe, it, expect, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { DatabaseError } from '../../utils/errors';

let dbManager: typeof import('../db').default;

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `switch-ai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'test.db');
}

describe('DatabaseManager', () => {
  let cleanupPaths: string[] = [];

  afterEach(() => {
    if (dbManager?.isConnected()) {
      dbManager.disconnect();
    }
    for (const p of cleanupPaths) {
      try {
        const dir = path.dirname(p);
        fs.rmSync(dir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
    cleanupPaths = [];
  });

  it('connects to a database', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const dbPath = tmpDbPath();
    cleanupPaths.push(dbPath);

    const result = await dbManager.connect(dbPath);
    expect(result).toBeDefined();
    expect(dbManager.isConnected()).toBe(true);
  });

  it('returns existing connection on second connect call', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const dbPath = tmpDbPath();
    cleanupPaths.push(dbPath);

    const first = await dbManager.connect(dbPath);
    const second = await dbManager.connect(dbPath);
    expect(first).toBe(second);
  });

  it('getDb returns the connected database', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const dbPath = tmpDbPath();
    cleanupPaths.push(dbPath);

    await dbManager.connect(dbPath);
    const result = dbManager.getDb();
    expect(result).toBeDefined();
  });

  it('getDb throws DatabaseError when not connected', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    if (dbManager.isConnected()) {
      dbManager.disconnect();
    }

    expect(() => dbManager.getDb()).toThrow(DatabaseError);
  });

  it('disconnect closes the connection', async () => {
    const { default: db } = await import('../db');
    dbManager = db;

    const dbPath = tmpDbPath();
    cleanupPaths.push(dbPath);

    await dbManager.connect(dbPath);
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

    const dbPath = tmpDbPath();
    const dir = path.dirname(dbPath);
    cleanupPaths.push(dbPath);

    await dbManager.connect(dbPath);
    expect(fs.existsSync(dir)).toBe(true);
    expect(dbManager.isConnected()).toBe(true);
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

    const dbPath = tmpDbPath();
    cleanupPaths.push(dbPath);

    const conn = await dbManager.connect(dbPath);
    const closeSpy = vi.spyOn(conn, 'close').mockImplementation(() => {
      throw new Error('close failed');
    });

    expect(() => dbManager.disconnect()).toThrow(DatabaseError);
    closeSpy.mockRestore();
  });
});
