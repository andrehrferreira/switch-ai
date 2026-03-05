export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class DatabaseError extends Error {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class ProxyError extends Error {
  readonly code = 'PROXY_ERROR';
  readonly statusCode = 500;

  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'ProxyError';
    Object.setPrototypeOf(this, ProxyError.prototype);
  }
}
