type LogLevel = 'info' | 'warn' | 'error';

type LogPayload = {
  timestamp: string;
  level: LogLevel;
  request_id: string | null;
  route: string | null;
  user_id: string | null;
  organization_id: string | null;
  event: string;
  detail: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: null;
};

export type RequestLogger = {
  info: (event: string, detail?: Record<string, unknown>) => void;
  warn: (event: string, detail?: Record<string, unknown>) => void;
  error: (event: string, detail?: Record<string, unknown>, err?: unknown) => void;
};

function errorMessageFrom(err: unknown): string | null {
  if (err == null) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function writeLog(payload: LogPayload): void {
  try {
    const line = JSON.stringify(payload);
    if (payload.level === 'error') {
      console.error(line);
    } else if (payload.level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch {
    console.error('[logger] Failed to serialize log payload');
  }
}

function log(
  level: LogLevel,
  context: {
    requestId: string | null;
    route: string | null;
    userId: string | null;
    organizationId: string | null;
  },
  event: string,
  detail?: Record<string, unknown>,
  err?: unknown,
): void {
  try {
    writeLog({
      timestamp: new Date().toISOString(),
      level,
      request_id: context.requestId,
      route: context.route,
      user_id: context.userId,
      organization_id: context.organizationId,
      event,
      detail: detail ?? null,
      error_message: level === 'error' ? errorMessageFrom(err) : null,
      duration_ms: null,
    });
  } catch {
    console.error('[logger] Failed to write log entry');
  }
}

export function createRequestLogger(
  requestId: string | null,
  route: string | null,
  userId: string | null,
  organizationId: string | null,
): RequestLogger {
  const context = { requestId, route, userId, organizationId };

  return {
    info(event: string, detail?: Record<string, unknown>) {
      log('info', context, event, detail);
    },
    warn(event: string, detail?: Record<string, unknown>) {
      log('warn', context, event, detail);
    },
    error(event: string, detail?: Record<string, unknown>, err?: unknown) {
      log('error', context, event, detail, err);
    },
  };
}

export const logger = createRequestLogger(null, null, null, null);
