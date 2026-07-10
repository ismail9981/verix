/*
 * Structured JSON logger.
 *
 * Emits one JSON object per line (level, timestamp, message, fields) so logs
 * are machine-parseable by any aggregator (Vercel, Datadog, etc.). Uses only
 * `console`, so it is safe in both the Node and Edge runtimes. Errors passed in
 * the fields are serialized to `{ name, message, stack }`.
 */

type Level = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function emit(level: Level, message: string, fields?: LogFields): void {
  const line = JSON.stringify(
    { level, time: new Date().toISOString(), message, ...fields },
    replacer,
  );
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
