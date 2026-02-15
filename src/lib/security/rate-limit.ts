import { NextRequest, NextResponse } from "next/server";

interface BucketState {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  id: string;
  limit: number;
  windowMs: number;
}

const globalRateLimitState = globalThis as unknown as {
  __rateLimitBuckets?: Map<string, BucketState>;
};

const buckets = globalRateLimitState.__rateLimitBuckets || new Map<string, BucketState>();
if (!globalRateLimitState.__rateLimitBuckets) {
  globalRateLimitState.__rateLimitBuckets = buckets;
}

function cleanExpired(now: number) {
  for (const [key, state] of buckets.entries()) {
    if (state.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function applyRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): { limited: false; remaining: number; resetAt: number } | { limited: true; response: NextResponse } {
  const now = Date.now();
  cleanExpired(now);

  const key = `${options.id}:${extractClientIp(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { limited: false, remaining: options.limit - 1, resetAt };
  }

  current.count += 1;
  buckets.set(key, current);

  if (current.count > options.limit) {
    const retrySeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const response = NextResponse.json(
      {
        error: "Too many requests",
        retryAfterSeconds: retrySeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retrySeconds),
        },
      }
    );

    return { limited: true, response };
  }

  return {
    limited: false,
    remaining: Math.max(0, options.limit - current.count),
    resetAt: current.resetAt,
  };
}
