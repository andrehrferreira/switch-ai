import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import type { CompatDatabase } from '../db';
import { initializeDatabase } from '../migrations';
import { DatabaseError } from '../../utils/errors';

async function createInMemoryDb(): Promise<{ db: CompatDatabase; close: () => void }> {
  const SQL = await initSqlJs();
  const sqlDb = new SQL.Database();

  const db: CompatDatabase = {
    exec(sql: string) {
      sqlDb.run(sql);
    },
    pragma(directive: string) {
      sqlDb.run(`PRAGMA ${directive}`);
    },
    prepare(sql: string) {
      return {
        run(...params: unknown[]) {
          sqlDb.run(sql, params as never[]);
        },
        get(...params: unknown[]): unknown {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params as never[]);
          if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
          }
          stmt.free();
          return undefined;
        },
        all(...params: unknown[]): unknown[] {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params as never[]);
          const results: unknown[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
    close() {
      sqlDb.close();
    },
  };

  return { db, close: () => sqlDb.close() };
}

describe('initializeDatabase', () => {
  it('creates all tables in an in-memory database', async () => {
    const { db } = await createInMemoryDb();
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

  it('creates all indexes', async () => {
    const { db } = await createInMemoryDb();
    initializeDatabase(db);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as Array<{ name: string }>;

    expect(indexes.length).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('is idempotent (can be called multiple times)', async () => {
    const { db } = await createInMemoryDb();
    initializeDatabase(db);
    initializeDatabase(db); // Should not throw

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    expect(tables.length).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('throws DatabaseError when initialization fails', async () => {
    const { db } = await createInMemoryDb();
    db.close(); // Close the db to simulate failure

    expect(() => initializeDatabase(db)).toThrow(DatabaseError);
  });
});
