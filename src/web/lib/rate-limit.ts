/**
 * Rate Limiting Utility
 * 
 * Security Layer: Prevents abuse and quota exhaustion
 * Implements token bucket and sliding window algorithms
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Token Bucket Rate Limiter
 * Allows burst requests up to maxRequests, then refills over time
 */
export class TokenBucketRateLimiter {
  private buckets: Map<string, RateLimitState> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'rate_limit',
      ...config
    };
  }

  /**
   * Check if request is allowed
   * @param key - Unique identifier (e.g., user ID, IP, endpoint)
   * @returns boolean - true if allowed, false if rate limited
   */
  async checkLimit(key: string): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    
    const state = this.buckets.get(fullKey) || {
      tokens: this.config.maxRequests,
      lastRefill: now
    };

    // Calculate tokens to refill
    const elapsed = now - state.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);
    
    // Refill tokens up to max
    state.tokens = Math.min(
      this.config.maxRequests,
      state.tokens + tokensToAdd
    );
    state.lastRefill = now;

    // Check if we have tokens available
    if (state.tokens > 0) {
      state.tokens--;
      this.buckets.set(fullKey, state);
      return true;
    }

    // Rate limited
    const retryAfter = Math.ceil((1 / refillRate));
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfter}ms`,
      retryAfter
    );
  }

  /**
   * Get current token count for a key
   */
  getTokenCount(key: string): number {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const state = this.buckets.get(fullKey);
    if (!state) return this.config.maxRequests;

    const now = Date.now();
    const elapsed = now - state.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    return Math.min(this.config.maxRequests, state.tokens + tokensToAdd);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    this.buckets.delete(fullKey);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.buckets.clear();
  }
}

/**
 * Sliding Window Rate Limiter
 * Tracks exact timestamps for more precise rate limiting
 */
export class SlidingWindowRateLimiter {
  private windows: Map<string, number[]> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'sliding_window',
      ...config
    };
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(key: string): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let timestamps = this.windows.get(fullKey) || [];
    
    // Remove old timestamps outside the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if under limit
    if (timestamps.length < this.config.maxRequests) {
      timestamps.push(now);
      this.windows.set(fullKey, timestamps);
      return true;
    }

    // Rate limited - calculate retry after
    const oldestTimestamp = timestamps[0];
    const retryAfter = oldestTimestamp + this.config.windowMs - now;
    
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s`,
      retryAfter
    );
  }

  /**
   * Get current request count in window
   */
  getRequestCount(key: string): number {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = this.windows.get(fullKey) || [];
    return timestamps.filter(ts => ts > windowStart).length;
  }
}

// Pre-configured rate limiters for common use cases

/**
 * Firestore read rate limiter
 * Prevents exceeding Firebase Spark plan limits (50K reads/day)
 */
export const firestoreReadLimiter = new TokenBucketRateLimiter({
  maxRequests: 100,  // Max 100 reads per minute per user
  windowMs: 60 * 1000,  // 1 minute window
  keyPrefix: 'firestore_read'
});

/**
 * Firestore write rate limiter
 * Prevents exceeding Firebase Spark plan limits (20K writes/day)
 */
export const firestoreWriteLimiter = new TokenBucketRateLimiter({
  maxRequests: 20,  // Max 20 writes per minute per user
  windowMs: 60 * 1000,  // 1 minute window
  keyPrefix: 'firestore_write'
});

/**
 * Gemini API rate limiter
 * Respects Gemini free tier limits (60 requests/min)
 */
export const geminiRateLimiter = new TokenBucketRateLimiter({
  maxRequests: 50,  // Stay under 60/min with buffer
  windowMs: 60 * 1000,  // 1 minute window
  keyPrefix: 'gemini_api'
});

/**
 * General API rate limiter for custom endpoints
 */
export const apiRateLimiter = new SlidingWindowRateLimiter({
  maxRequests: 30,  // 30 requests per minute
  windowMs: 60 * 1000,
  keyPrefix: 'api'
});

/**
 * Higher-order function to wrap async functions with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limiter: TokenBucketRateLimiter | SlidingWindowRateLimiter,
  getKey: (...args: Parameters<T>) => string
): T {
  return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    const key = getKey(...args);
    await limiter.checkLimit(key);
    return fn(...args);
  } as T;
}

/**
 * Rate limit decorator for class methods
 * Usage: @RateLimit({ maxRequests: 10, windowMs: 60000 })
 */
export function RateLimit(config: RateLimitConfig) {
  const limiter = new TokenBucketRateLimiter(config);
  
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const key = `${target.constructor.name}.${propertyKey}`;
      await limiter.checkLimit(key);
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}
