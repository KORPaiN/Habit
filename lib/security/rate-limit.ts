export type RateLimitRule = {
  name: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  rule: RateLimitRule;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __habitRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

function getStore() {
  if (!globalThis.__habitRateLimitStore) {
    globalThis.__habitRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return globalThis.__habitRateLimitStore;
}

function getKey(namespace: string, key: string, rule: RateLimitRule) {
  return `${namespace}:${rule.name}:${key}`;
}

function clearExpiredEntries(now: number) {
  const store = getStore();

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function consumeRateLimit(namespace: string, key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const store = getStore();
  clearExpiredEntries(now);

  const storeKey = getKey(namespace, key, rule);
  const existing = store.get(storeKey);
  const resetAt = existing && existing.resetAt > now ? existing.resetAt : now + rule.windowMs;
  const count = existing && existing.resetAt > now ? existing.count : 0;

  if (count >= rule.limit) {
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      rule,
    };
  }

  const nextCount = count + 1;
  store.set(storeKey, {
    count: nextCount,
    resetAt,
  });

  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - nextCount),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    rule,
  };
}

export function consumeRateLimits(namespace: string, key: string, rules: RateLimitRule[], now = Date.now()) {
  const results = rules.map((rule) => consumeRateLimit(namespace, key, rule, now));
  return results.find((result) => !result.allowed) ?? results[0] ?? null;
}

export function getRateLimitHeaders(result: RateLimitResult | null): Record<string, string> {
  if (!result) {
    return {};
  }

  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
    "Retry-After": String(result.retryAfterSeconds),
  };
}
