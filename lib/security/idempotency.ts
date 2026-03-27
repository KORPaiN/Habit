import { createHash } from "node:crypto";

export type IdempotencyReplay = {
  state: "replay";
  status: number;
  response: unknown;
};

export type IdempotencyConflict = {
  state: "conflict";
};

export type IdempotencyClaim = {
  state: "started";
  commit: (response: unknown, status?: number) => void;
  clear: () => void;
};

type IdempotencyEntry = {
  bodyHash: string;
  status: "in_progress" | "completed";
  response?: unknown;
  responseStatus?: number;
  expiresAt: number;
};

declare global {
  var __habitIdempotencyStore: Map<string, IdempotencyEntry> | undefined;
}

function getStore() {
  if (!globalThis.__habitIdempotencyStore) {
    globalThis.__habitIdempotencyStore = new Map<string, IdempotencyEntry>();
  }

  return globalThis.__habitIdempotencyStore;
}

function clearExpiredEntries(now: number) {
  const store = getStore();

  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function hashIdempotencyPayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

export function beginIdempotentRequest(input: {
  scope: string;
  key: string;
  bodyHash: string;
  ttlMs?: number;
  now?: number;
}): IdempotencyReplay | IdempotencyConflict | IdempotencyClaim {
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? 1000 * 60 * 30;
  const store = getStore();
  clearExpiredEntries(now);

  const storeKey = `${input.scope}:${input.key}`;
  const existing = store.get(storeKey);

  if (existing) {
    if (existing.bodyHash !== input.bodyHash) {
      return { state: "conflict" };
    }

    if (existing.status === "completed") {
      return {
        state: "replay",
        status: existing.responseStatus ?? 200,
        response: existing.response,
      };
    }

    return { state: "conflict" };
  }

  store.set(storeKey, {
    bodyHash: input.bodyHash,
    status: "in_progress",
    expiresAt: now + ttlMs,
  });

  return {
    state: "started",
    commit(response: unknown, status = 200) {
      store.set(storeKey, {
        bodyHash: input.bodyHash,
        status: "completed",
        response,
        responseStatus: status,
        expiresAt: now + ttlMs,
      });
    },
    clear() {
      store.delete(storeKey);
    },
  };
}
