export function parseEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;

  return parsed;
}

export function parseEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;

  return value.toLowerCase() === 'true';
}

export function parseEnvString(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value ?? defaultValue;
}

export function getEnv(key: string): string | undefined {
  return process.env[key];
}
