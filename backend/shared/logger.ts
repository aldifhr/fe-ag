// Suppress Node.js url.parse() deprecation warning from dependencies
if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("warning", (warning) => {
    if (warning.name === "DeprecationWarning" && warning.message.includes("url.parse()")) {
      return; // Suppress url.parse() warnings from dependencies
    }
    console.warn(warning);
  });
}

import { env } from "./config/env.js";

// Determine log level from environment
const LOG_LEVEL = env.LOG_LEVEL || "info";

export type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_VALUES: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export interface Logger {
  level: string;
  child(bindings: Record<string, any>): Logger;
  trace(msg: string, ...args: any[]): void;
  trace(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  debug(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  info(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  warn(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  error(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  fatal(msg: string, ...args: any[]): void;
  fatal(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  [key: string]: any;
}

class SimpleConsoleLogger implements Logger {
  public level: string;
  private bindings: Record<string, any>;
  private minLevelValue: number;
  [key: string]: any;

  constructor(bindings: Record<string, any> = {}, minLevel: Level = LOG_LEVEL as Level) {
    this.level = minLevel;
    this.bindings = bindings;
    this.minLevelValue = LEVEL_VALUES[minLevel] || 30;
  }

  public child(newBindings: Record<string, any>): Logger {
    return new SimpleConsoleLogger(
      { ...this.bindings, ...newBindings },
      LOG_LEVEL as Level
    );
  }

  private log(level: Level, msgOrObj: any, msg?: string) {
    const levelVal = LEVEL_VALUES[level];
    if (levelVal < this.minLevelValue) return;

    let obj: Record<string, any> = {};
    let finalMsg = "";

    if (typeof msgOrObj === "string") {
      finalMsg = msgOrObj;
    } else if (msgOrObj && typeof msgOrObj === "object") {
      obj = msgOrObj;
      finalMsg = msg || obj.message || obj.msg || "";
    }

    const payload: Record<string, any> = {
      level: levelVal,
      time: Date.now(),
      msg: finalMsg,
      pid: typeof process !== "undefined" ? process.pid : undefined,
      env: env.NODE_ENV || "development",
      ...this.bindings,
      ...obj,
    };

    // Serialize error if present
    if (payload.err && payload.err instanceof Error) {
      payload.err = {
        message: payload.err.message,
        stack: payload.err.stack,
        name: payload.err.name,
      };
    }

    const isDev = (env.NODE_ENV || "development") === "development";

    if (isDev) {
      this.logPretty(level, payload);
    } else {
      console.log(JSON.stringify(payload));
    }
  }

  private logPretty(level: Level, payload: Record<string, any>) {
    // Colors: dim timestamp, colored level, cyan scope, white message
    const LEVEL_COLORS: Record<string, string> = {
      trace: "\x1b[90m",   // gray
      debug: "\x1b[36m",   // cyan
      info: "\x1b[32m",    // green
      warn: "\x1b[33m",    // yellow
      error: "\x1b[31m",   // red
      fatal: "\x1b[35m",   // magenta
    };
    const RESET = "\x1b[0m";
    const DIM = "\x1b[2m";
    const BOLD = "\x1b[1m";
    const CYAN = "\x1b[36m";

    const time = new Date(payload.time).toLocaleTimeString("en-GB", { hour12: false });
    const color = LEVEL_COLORS[level] || "";
    const levelTag = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
    const scope = payload.scope || payload.module || "";
    const scopeTag = scope ? `${CYAN}${scope}${RESET} ` : "";

    // Extract extra key=value pairs (skip internal fields)
    const SKIP = new Set(["level", "time", "msg", "pid", "env", "scope", "module", "correlationId", "requestId", "err"]);
    const extras = Object.entries(payload)
      .filter(([k, v]) => !SKIP.has(k) && v !== undefined && v !== null)
      .map(([k, v]) => {
        const val = typeof v === "object" ? JSON.stringify(v) : v;
        return `${DIM}${k}=${val}${RESET}`;
      });

    const parts = [
      `${DIM}${time}${RESET}`,
      levelTag,
      scopeTag,
      BOLD + payload.msg + RESET,
    ];
    if (extras.length) parts.push(extras.join(" "));

    console.log(parts.join(" "));
  }

  public trace(msg: string, ...args: any[]): void;
  public trace(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public trace(msgOrObj: any, msg?: string) { this.log("trace", msgOrObj, msg); }

  public debug(msg: string, ...args: any[]): void;
  public debug(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public debug(msgOrObj: any, msg?: string) { this.log("debug", msgOrObj, msg); }

  public info(msg: string, ...args: any[]): void;
  public info(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public info(msgOrObj: any, msg?: string) { this.log("info", msgOrObj, msg); }

  public warn(msg: string, ...args: any[]): void;
  public warn(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public warn(msgOrObj: any, msg?: string) { this.log("warn", msgOrObj, msg); }

  public error(msg: string, ...args: any[]): void;
  public error(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public error(msgOrObj: any, msg?: string) { this.log("error", msgOrObj, msg); }

  public fatal(msg: string, ...args: any[]): void;
  public fatal(obj: Record<string, any>, msg?: string, ...args: any[]): void;
  public fatal(msgOrObj: any, msg?: string) { this.log("fatal", msgOrObj, msg); }
}

const baseLogger = new SimpleConsoleLogger();

import type { LoggerOptions } from "./types.js";
export type { LoggerOptions } from "./types.js";

// AsyncLocalStorage for request context (correlation ID)
import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  guildId?: string;
  path?: string;
  method?: string;
}

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStore.run(context, fn);
}

export function getCurrentContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

// Generate correlation ID
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Create a child logger factory with scope
export function getLogger(bindings: LoggerOptions = {}): Logger {
  const { scope, module, ...rest } = bindings;

  const childBindings: Record<string, any> = {
    ...rest,
  };

  if (scope) {
    childBindings.scope = scope;
  }
  if (module) {
    childBindings.module = module;
  }

  // Add correlation ID from context if available
  const context = getCurrentContext();
  if (context?.correlationId) {
    childBindings.correlationId = context.correlationId;
  }

  return baseLogger.child(childBindings);
}

// Pre-configured loggers for common modules
export const loggers = {
  api: getLogger({ scope: "api" }),
  cron: getLogger({ scope: "cron" }),
  discord: getLogger({ scope: "discord" }),
  scraper: getLogger({ scope: "scraper" }),
  dispatch: getLogger({ scope: "dispatch" }),
  auth: getLogger({ scope: "auth" }),
  commands: getLogger({ scope: "commands" }),
};

// Fast log helpers (for hot paths where creating child logger is expensive)
export const fastLog = {
  debug: (msg: string, meta: Record<string, any> = {}) => baseLogger.debug(meta, msg),
  info: (msg: string, meta: Record<string, any> = {}) => baseLogger.info(meta, msg),
  warn: (msg: string, meta: Record<string, any> = {}) => baseLogger.warn(meta, msg),
  error: (msg: string, meta: Record<string, any> = {}) => baseLogger.error(meta, msg),
  fatal: (msg: string, meta: Record<string, any> = {}) => baseLogger.fatal(meta, msg),
};

// Request logging middleware pattern
export function requestLogger(req: any, res: any, next: () => void) {
  const start = Date.now();
  const requestId =
    req.headers["x-request-id"] || req.headers["x-vercel-id"] || `req-${start}`;

  const log = getLogger({
    scope: "http",
    requestId,
    method: req.method,
    path: req.path,
  });

  req.log = log;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = (res.statusCode >= 400 ? "warn" : "info") as Level;

    log[level](
      {
        res: {
          statusCode: res.statusCode,
          duration,
        },
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      },
      `${req.method} ${req.path} ${res.statusCode}`,
    );
  });

  next();
}

// Error logging helper with stack trace
export function logError(err: unknown, context: Record<string, any> = {}, logger: Logger = baseLogger) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const errorObj = err instanceof Error ? err : (typeof err === "object" && err ? err : {});
  const code = (errorObj as Record<string, unknown>)?.code;
  const type = errorObj?.constructor?.name;

  logger.error(
    {
      err: {
        message,
        stack,
        code,
        type,
      },
      ...context,
    },
    message || "An error occurred",
  );
}

// Performance logging helper
export function logPerformance(
  operation: string,
  durationMs: number,
  meta: Record<string, any> = {},
  logger: Logger = baseLogger,
) {
  const level = (durationMs > 1000 ? "warn" : "debug") as Level;

  logger[level](
    {
      operation,
      duration: durationMs,
      ...meta,
    },
    `${operation} completed in ${durationMs}ms`,
  );
}

// Backward-compatible API logging functions

function buildReqMeta(req: any) {
  const method = req?.method ?? "UNKNOWN";
  const path = req?.url ?? "";
  const reqId =
    req?.headers?.["x-vercel-id"] ||
    req?.headers?.["x-request-id"] ||
    req?.headers?.["cf-ray"] ||
    null;
  const ip =
    req?.headers?.["x-forwarded-for"] || req?.headers?.["x-real-ip"] || null;
  return { method, path, reqId, ip };
}

export function logApiHit(name: string, req: any): Logger {
  const meta = buildReqMeta(req);
  const logger = getLogger({ endpoint: name, ...meta });
  logger.info({ event: "request_start" }, "api request");
  return logger;
}

export function logApiOk(logger: Logger | null | undefined, extra: Record<string, any> = {}) {
  if (!logger) return;
  logger.info({ event: "request_ok", ...extra }, "api success");
}

export function logApiError(logger: Logger | null | undefined, err: unknown, extra: Record<string, unknown> = {}) {
  if (!logger) return;
  const e = err as Record<string, unknown> | undefined;
  const response = e?.response as Record<string, unknown> | undefined;
  const config = e?.config as Record<string, unknown> | undefined;
  const statusCode = (response?.status as number) ?? (extra.statusCode as number) ?? null;
  const errCode = (extra.code as string) || (e?.code as string) || (statusCode ? `http_${statusCode}` : null);
  const errType = (extra.type as string) || (e?.name as string) || "Error";

  const filteredHeaders = { ...(config?.headers as Record<string, string> | undefined) };
  if (filteredHeaders.Authorization)
    filteredHeaders.Authorization = "[REDACTED]";
  if (filteredHeaders.Cookie) filteredHeaders.Cookie = "[REDACTED]";

  logger.error(
    {
      event: "request_error",
      err: (e?.message as string) || String(err),
      errCode,
      errType,
      statusCode,
      url: config?.url as string,
      method: config?.method as string,
      ...extra,
    },
    "api error",
  );
}

export async function sendErrorLog(webhookUrl: string | undefined, error: any, context = "") {
  if (!webhookUrl) return;
  try {
    const payload = {
      embeds: [
        {
          title: "Bot Error",
          description: `\`\`\`${error.message || error}\`\`\``,
          color: 0xff0000,
          fields: [
            { name: "Context", value: context || "Unknown", inline: true },
            { name: "Time", value: new Date().toISOString(), inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendErrorLog] Failed to send error log:", msg);
  }
}

// Export base logger for direct use
export default baseLogger;

// Re-export log levels for convenience
export const levels = LEVEL_VALUES;
