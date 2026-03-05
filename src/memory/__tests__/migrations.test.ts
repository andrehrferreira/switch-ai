import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../migrations';
import { DatabaseError } from '../../utils/errors';

describe('initializeDatabase', () => {
  it('creates all tables in an in-memory database', () => {
    const db = new Database(':memory:');
    initializeDatabase(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('requests');
    expect(tableNames).toContain('model_performance');
    expect(tableNames).toContain('failure_patterns');
    expect(tableNames).toContain('escalations');
    expect(tableNames).toContain('cost_analysis');
    expect(tableNames).toContain('model_ratings');

    db.close();
  });

  it('creates all indexes', () => {
    const db = new Database(':memory:');
    initializeDatabase(db);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as Array<{ name: string }>;

    expect(indexes.length).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('is idempotent (can be called multiple times)', () => {
    const db = new Database(':memory:');
    initializeDatabase(db);
    initializeDatabase(db); // Should not throw

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    expect(tables.length).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('throws DatabaseError when initialization fails', () => {
    const db = new Database(':memory:');
    db.close(); // Close the db to simulate failure

    expect(() => initializeDatabase(db)).toThrow(DatabaseError);
  });
});
