type RateLimitEntry = {
  count: number;
  windowStart: number;
};

export function createIpRateLimiter(windowMs: number, maxRequests: number) {
  const store: Record<string, RateLimitEntry> = {};

  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = store[ip];

    if (!entry || now - entry.windowStart > windowMs) {
      store[ip] = { count: 1, windowStart: now };
      return false;
    }

    entry.count += 1;
    return entry.count > maxRequests;
  };
}

