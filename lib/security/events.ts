import { createHash } from "node:crypto";

type SecurityEvent = {
  type: string;
  level?: "info" | "warn" | "error";
  requestId?: string;
  route?: string;
  userId?: string;
  ip?: string | null;
  outcome?: string;
  statusCode?: number;
  detail?: Record<string, unknown>;
};

type SafeDetailValue = boolean | number | string | null;

function toSafeDetailValue(value: unknown): SafeDetailValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, 160);
  }

  return undefined;
}

function sanitizeDetail(detail?: Record<string, unknown>) {
  if (!detail) {
    return undefined;
  }

  const sanitized: Record<string, SafeDetailValue> = {};

  for (const [key, value] of Object.entries(detail)) {
    const safeValue = toSafeDetailValue(value);

    if (safeValue !== undefined) {
      sanitized[key] = safeValue;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function hashIdentifier(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function logSecurityEvent(event: SecurityEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    type: event.type,
    requestId: event.requestId,
    route: event.route,
    userHash: hashIdentifier(event.userId),
    ipHash: hashIdentifier(event.ip),
    outcome: event.outcome,
    statusCode: event.statusCode,
    detail: sanitizeDetail(event.detail),
  };

  const message = `[security-event] ${JSON.stringify(payload)}`;

  if (event.level === "error") {
    console.error(message);
    return;
  }

  if (event.level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}
