import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DatabaseError } from '../utils/errors';
import { initializeDatabase } from './migrations';

class DatabaseManager {
  private db: Database.Database | null = null;

  connect(dbPath: string): Database.Database {
    try {
      if (this.db) {
        return this.db;
      }

      // Ensure directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create or open database
      this.db = new Database(dbPath);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Initialize schema if fresh database
      initializeDatabase(this.db);

      return this.db;
    } catch (error) {
      throw new DatabaseError(`Failed to connect to database: ${String(error)}`);
    }
  }

  getDb(): Database.Database {
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
