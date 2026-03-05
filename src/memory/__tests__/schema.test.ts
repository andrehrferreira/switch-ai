import { describe, it, expect } from 'vitest';
import { SCHEMA, INDEXES } from '../schema';

describe('SCHEMA', () => {
  it('has all 6 tables defined', () => {
    expect(Object.keys(SCHEMA)).toHaveLength(6);
    expect(SCHEMA).toHaveProperty('requests');
    expect(SCHEMA).toHaveProperty('model_performance');
    expect(SCHEMA).toHaveProperty('failure_patterns');
    expect(SCHEMA).toHaveProperty('escalations');
    expect(SCHEMA).toHaveProperty('cost_analysis');
    expect(SCHEMA).toHaveProperty('model_ratings');
  });

  it('each table definition contains CREATE TABLE IF NOT EXISTS', () => {
    for (const sql of Object.values(SCHEMA)) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    }
  });

  it('requests table has required columns', () => {
    expect(SCHEMA.requests).toContain('id TEXT PRIMARY KEY');
    expect(SCHEMA.requests).toContain('initial_model');
    expect(SCHEMA.requests).toContain('final_model');
    expect(SCHEMA.requests).toContain('status');
  });

  it('model_performance has composite primary key', () => {
    expect(SCHEMA.model_performance).toContain('PRIMARY KEY (model, category)');
  });
});

describe('INDEXES', () => {
  it('has 6 index definitions', () => {
    expect(INDEXES).toHaveLength(6);
  });

  it('each index contains CREATE INDEX IF NOT EXISTS', () => {
    for (const sql of INDEXES) {
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
    }
  });
});
