import type { CompatDatabase } from './db';
import { SCHEMA, INDEXES } from './schema';
import { DatabaseError } from '../utils/errors';

export function initializeDatabase(db: CompatDatabase): void {
  try {
    for (const tableSql of Object.values(SCHEMA)) {
      db.exec(tableSql);
    }

    for (const indexSql of INDEXES) {
      db.exec(indexSql);
    }
  } catch (error) {
    throw new DatabaseError(`Failed to initialize database: ${String(error)}`);
  }
}
