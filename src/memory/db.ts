import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { DatabaseError } from '../utils/errors';

export interface PreparedStatement {
  run(...params: unknown[]): void;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface CompatDatabase {
  exec(sql: string): void;
  pragma(directive: string): void;
  prepare(sql: string): PreparedStatement;
  close(): void;
}

function wrapDatabase(sqlDb: SqlJsDatabase, dbPath: string): CompatDatabase {
  const save = () => {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  };

  return {
    exec(sql: string) {
      sqlDb.run(sql);
      save();
    },

    pragma(directive: string) {
      sqlDb.run(`PRAGMA ${directive}`);
    },

    prepare(sql: string): PreparedStatement {
      return {
        run(...params: unknown[]) {
          sqlDb.run(sql, params as never[]);
          save();
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
      save();
      sqlDb.close();
    },
  };
}

class DatabaseManager {
  private db: CompatDatabase | null = null;

  async connect(dbPath: string): Promise<CompatDatabase> {
    try {
      if (this.db) {
        return this.db;
      }

      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const SQL = await initSqlJs();

      let sqlDb: SqlJsDatabase;
      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        sqlDb = new SQL.Database(fileBuffer);
      } else {
        sqlDb = new SQL.Database();
      }

      this.db = wrapDatabase(sqlDb, dbPath);

      this.db.pragma('foreign_keys = ON');

      const { initializeDatabase } = await import('./migrations');
      initializeDatabase(this.db);

      return this.db;
    } catch (error) {
      throw new DatabaseError(`Failed to connect to database: ${String(error)}`);
    }
  }

  getDb(): CompatDatabase {
    if (!this.db) {
      throw new DatabaseError('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  disconnect(): void {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (error) {
        throw new DatabaseError(`Failed to disconnect from database: ${String(error)}`);
      }
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }
}

export default new DatabaseManager();
