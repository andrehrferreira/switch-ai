import { z } from 'zod';

export const ConfigSchema = z
  .object({
    server: z
      .object({
        port: z.number().int().positive().max(65535),
        host: z.string(),
        cors: z.boolean(),
        logLevel: z.enum(['debug', 'info', 'warn', 'error']),
      })
      .strict(),
    models: z
      .object({
        defaultTier: z.enum(['free', 'cheap', 'balanced', 'premium']),
        maxCostPerRequest: z.number().nonnegative(),
      })
      .strict(),
    memory: z
      .object({
        enabled: z.boolean(),
        path: z.string(),
        retentionDays: z.number().int().positive(),
      })
      .strict(),
    learning: z
      .object({
        enabled: z.boolean(),
        autoBlacklist: z.boolean(),
        minSuccessThreshold: z.number().min(0).max(1),
      })
      .strict(),
    validation: z
      .object({
        enabled: z.boolean(),
        escalationRetries: z.number().int().nonnegative(),
        timeoutMs: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
