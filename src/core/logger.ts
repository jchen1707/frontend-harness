import { env } from '@/env';

// Cross-cutting structured logger (the frontend analog of structlog).
// This module is the single sanctioned place for console output.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[env.VITE_LOG_LEVEL]) return;
  const entry = JSON.stringify({ level, message, ...context });
  /* eslint-disable no-console */
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
  /* eslint-enable no-console */
}

export const logger = {
  debug: (message: string, context?: LogContext): void => {
    emit('debug', message, context);
  },
  info: (message: string, context?: LogContext): void => {
    emit('info', message, context);
  },
  warn: (message: string, context?: LogContext): void => {
    emit('warn', message, context);
  },
  error: (message: string, context?: LogContext): void => {
    emit('error', message, context);
  },
};
