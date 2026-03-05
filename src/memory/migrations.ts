import Database from 'better-sqlite3';
import { SCHEMA, INDEXES } from './schema';
import { DatabaseError } from '../utils/errors';

export function initializeDatabase(db: Database.Database): void {
  try {
    // Create all tables
    for (const tableSql of Object.values(SCHEMA)) {
      db.exec(tableSql);
    }

    // Create all indexes
    for (const indexSql of INDEXES) {
      db.exec(indexSql);
    }
  } catch (error) {
    throw new DatabaseError(`Failed to initialize database: ${String(error)}`);
  }
}
