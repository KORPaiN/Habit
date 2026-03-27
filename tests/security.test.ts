import test from "node:test";
import assert from "node:assert/strict";

import { beginIdempotentRequest, hashIdempotencyPayload } from "@/lib/security/idempotency";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getSecurityHeaders } from "@/lib/security/headers";
import { isSameOriginRequest } from "@/lib/security/route-guard";

test("rate limiting blocks requests after the configured limit", () => {
  const rule = {
    name: "minute",
    limit: 2,
    windowMs: 60_000,
  };
  const key = "user-1";
  const namespace = "tests";
  const now = Date.now();

  const first = consumeRateLimit(namespace, key, rule, now);
  const second = consumeRateLimit(namespace, key, rule, now + 1);
  const third = consumeRateLimit(namespace, key, rule, now + 2);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSeconds > 0, true);
});

test("idempotency replays the same request and rejects a body mismatch", () => {
  const scope = "user-1:/api/plans";
  const key = "idempotency-key-1";
  const firstBodyHash = hashIdempotencyPayload(JSON.stringify({ goalId: "a" }));
  const secondBodyHash = hashIdempotencyPayload(JSON.stringify({ goalId: "b" }));
  const started = beginIdempotentRequest({
    scope,
    key,
    bodyHash: firstBodyHash,
    now: 1,
  });

  assert.equal(started.state, "started");

  if (started.state !== "started") {
    throw new Error("Expected an idempotency claim.");
  }

  started.commit({ ok: true }, 201);

  const replay = beginIdempotentRequest({
    scope,
    key,
    bodyHash: firstBodyHash,
    now: 2,
  });
  const conflict = beginIdempotentRequest({
    scope,
    key,
    bodyHash: secondBodyHash,
    now: 3,
  });

  assert.equal(replay.state, "replay");
  assert.equal(conflict.state, "conflict");

  if (replay.state !== "replay") {
    throw new Error("Expected an idempotency replay.");
  }

  assert.deepEqual(replay.response, { ok: true });
  assert.equal(replay.status, 201);
});

test("same-origin detection allows local requests and blocks foreign origins", () => {
  const sameOriginRequest = new Request("https://habit.local/api/plans", {
    method: "POST",
    headers: {
      origin: "https://habit.local",
    },
  });
  const crossOriginRequest = new Request("https://habit.local/api/plans", {
    method: "POST",
    headers: {
      origin: "https://evil.example",
    },
  });

  assert.equal(isSameOriginRequest(sameOriginRequest), true);
  assert.equal(isSameOriginRequest(crossOriginRequest), false);
});

test("security headers include a CSP and clickjacking protection", () => {
  const headers = getSecurityHeaders();

  assert.match(headers.get("Content-Security-Policy") ?? "", /default-src 'self'/);
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
});
