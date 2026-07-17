import { createHash } from "crypto";

type AttemptState = {
  failures: number[];
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class AttemptRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  check(key: string): RateLimitResult {
    const timestamp = this.now();
    const cutoff = timestamp - this.windowMs;
    const state = this.attempts.get(key);
    if (!state) return { allowed: true, retryAfterSeconds: 0 };

    state.failures = state.failures.filter((failure) => failure > cutoff);
    if (state.failures.length === 0) {
      this.attempts.delete(key);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (state.failures.length < this.maxFailures) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.failures[0] + this.windowMs - timestamp) / 1000)
      ),
    };
  }

  recordFailure(key: string): void {
    this.check(key);
    const state = this.attempts.get(key) ?? { failures: [] };
    state.failures.push(this.now());
    this.attempts.set(key, state);

    // Keep memory bounded even when an attacker rotates identifiers.
    if (this.attempts.size > 10_000) {
      for (const candidate of [...this.attempts.keys()]) this.check(candidate);
      while (this.attempts.size > 8_000) {
        const oldest = this.attempts.keys().next().value;
        if (oldest === undefined) break;
        this.attempts.delete(oldest);
      }
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export function rateLimitKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export function clientIp(request: Request): string {
  // Caddy must overwrite these headers and the Next.js port must not be
  // internet-accessible; see the deployment notes in README.md.
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const globalRateLimits = globalThis as unknown as {
  benefitHqLoginAccountLimiter?: AttemptRateLimiter;
  benefitHqLoginIpLimiter?: AttemptRateLimiter;
  benefitHqBootstrapLimiter?: AttemptRateLimiter;
};

export const loginAccountLimiter =
  globalRateLimits.benefitHqLoginAccountLimiter ??
  new AttemptRateLimiter(10, 15 * 60 * 1000);
export const loginIpLimiter =
  globalRateLimits.benefitHqLoginIpLimiter ??
  new AttemptRateLimiter(50, 15 * 60 * 1000);
export const bootstrapLimiter =
  globalRateLimits.benefitHqBootstrapLimiter ??
  new AttemptRateLimiter(10, 15 * 60 * 1000);

globalRateLimits.benefitHqLoginAccountLimiter = loginAccountLimiter;
globalRateLimits.benefitHqLoginIpLimiter = loginIpLimiter;
globalRateLimits.benefitHqBootstrapLimiter = bootstrapLimiter;
