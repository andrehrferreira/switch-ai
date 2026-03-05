import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private stream: fs.WriteStream | null = null;

  private levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  /** Redirect all log output to a file instead of stdout/stderr. */
  setLogFile(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.level];
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    return JSON.stringify(entry);
  }

  private write(level: LogLevel, line: string): void {
    if (this.stream) {
      this.stream.write(line + '\n');
    } else if (level === 'warn' || level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) this.write('debug', this.format('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) this.write('info', this.format('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) this.write('warn', this.format('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) this.write('error', this.format('error', message, context));
  }
}

export default new Logger();
