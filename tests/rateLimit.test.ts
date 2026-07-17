import assert from "node:assert/strict";
import test from "node:test";
import { AttemptRateLimiter, clientIp, rateLimitKey } from "@/lib/rateLimit";

test("attempt limiter blocks a key for the configured sliding window", () => {
  let now = 1_000;
  const limiter = new AttemptRateLimiter(2, 10_000, () => now);
  const key = rateLimitKey("login", "example");

  assert.equal(limiter.check(key).allowed, true);
  limiter.recordFailure(key);
  assert.equal(limiter.check(key).allowed, true);
  limiter.recordFailure(key);
  assert.equal(limiter.check(key).allowed, false);
  assert.equal(limiter.check(key).retryAfterSeconds, 10);

  now += 10_001;
  assert.equal(limiter.check(key).allowed, true);
});

test("successful authentication resets account failures", () => {
  const limiter = new AttemptRateLimiter(1, 10_000, () => 1_000);
  limiter.recordFailure("account");
  assert.equal(limiter.check("account").allowed, false);
  limiter.reset("account");
  assert.equal(limiter.check("account").allowed, true);
});

test("client IP prefers the reverse proxy's canonical header", () => {
  const request = new Request("https://benefit.test", {
    headers: {
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.4, 10.0.0.1",
    },
  });
  assert.equal(clientIp(request), "203.0.113.7");
});
