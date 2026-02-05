/**
 * Gemini API Rate Limit Tests
 * Tests Gemini free tier limits (60 requests/min)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe('Gemini API Rate Limiting Tests', () => {
  let mockGenerateContent: jest.Mock;
  let genAI: GoogleGenerativeAI;
  let model: any;

  beforeEach(() => {
    jest.clearAllMocks();
    genAI = new GoogleGenerativeAI('test-api-key');
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    mockGenerateContent = model.generateContent as jest.Mock;
  });

  describe('Rate Limit Monitoring', () => {
    it('should track request count per minute', async () => {
      class RateLimiter {
        private requestCount = 0;
        private readonly MAX_REQUESTS_PER_MINUTE = 60;
        private requestTimestamps: number[] = [];

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          
          // Clean old timestamps
          this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
          
          if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
            const waitTime = this.requestTimestamps[0] + 60000 - now;
            throw new Error(`Rate limit exceeded. Retry after ${waitTime}ms`);
          }

          this.requestTimestamps.push(now);
          this.requestCount++;
          
          return fn();
        }

        get currentCount(): number {
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          return this.requestTimestamps.filter(ts => ts > oneMinuteAgo).length;
        }

        get remainingRequests(): number {
          return this.MAX_REQUESTS_PER_MINUTE - this.currentCount;
        }
      }

      const limiter = new RateLimiter();
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'result' } });

      // Execute 10 requests
      for (let i = 0; i < 10; i++) {
        await limiter.execute(() => model.generateContent('test'));
      }

      expect(limiter.currentCount).toBe(10);
      expect(limiter.remainingRequests).toBe(50);
    });

    it('should enforce 60 requests/minute limit', async () => {
      class RateLimiter {
        private requestTimestamps: number[] = [];
        private readonly MAX_REQUESTS = 60;

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          
          this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
          
          if (this.requestTimestamps.length >= this.MAX_REQUESTS) {
            throw new Error('Rate limit exceeded: 60 requests per minute');
          }

          this.requestTimestamps.push(now);
          return fn();
        }
      }

      const limiter = new RateLimiter();
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'result' } });

      // Should allow 60 requests
      for (let i = 0; i < 60; i++) {
        await limiter.execute(() => model.generateContent('test'));
      }

      // 61st request should fail
      await expect(
        limiter.execute(() => model.generateContent('test'))
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should implement token bucket algorithm for rate limiting', async () => {
      class TokenBucket {
        private tokens: number;
        private lastRefill: number;
        private readonly maxTokens = 60;
        private readonly refillRate = 1; // 1 token per second

        constructor() {
          this.tokens = this.maxTokens;
          this.lastRefill = Date.now();
        }

        private refill(): void {
          const now = Date.now();
          const elapsed = (now - this.lastRefill) / 1000;
          const tokensToAdd = Math.floor(elapsed * this.refillRate);
          
          this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
          this.lastRefill = now;
        }

        async consume(): Promise<boolean> {
          this.refill();
          
          if (this.tokens > 0) {
            this.tokens--;
            return true;
          }
          
          return false;
        }

        get availableTokens(): number {
          this.refill();
          return this.tokens;
        }
      }

      const bucket = new TokenBucket();
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'result' } });

      // Consume 50 tokens
      for (let i = 0; i < 50; i++) {
        const canProceed = await bucket.consume();
        expect(canProceed).toBe(true);
      }

      expect(bucket.availableTokens).toBe(10);

      // Consume remaining 10
      for (let i = 0; i < 10; i++) {
        const canProceed = await bucket.consume();
        expect(canProceed).toBe(true);
      }

      // Bucket should be empty
      expect(bucket.availableTokens).toBe(0);
      expect(await bucket.consume()).toBe(false);
    });
  });

  describe('Rate Limit Error Handling', () => {
    it('should handle 429 Too Many Requests error', async () => {
      const rateLimitError = new Error('429 Too Many Requests');
      (rateLimitError as any).status = 429;
      
      mockGenerateContent.mockRejectedValueOnce(rateLimitError);

      await expect(model.generateContent('test'))
        .rejects.toThrow('429 Too Many Requests');
    });

    it('should implement exponential backoff for rate limit retries', async () => {
      const exponentialBackoff = async (
        fn: () => Promise<any>,
        maxRetries = 3,
        baseDelay = 1000
      ): Promise<any> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn();
          } catch (error: any) {
            if (error.message?.includes('429') && i < maxRetries - 1) {
              const delay = baseDelay * Math.pow(2, i);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      };

      const rateLimitError = new Error('429 Too Many Requests');
      
      // Fail twice with 429, succeed on third
      mockGenerateContent
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ response: { text: () => 'success' } });

      const result = await exponentialBackoff(() => model.generateContent('test'));
      expect(result.response.text()).toBe('success');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should queue requests when rate limit is approached', async () => {
      class RequestQueue {
        private queue: Array<() => Promise<any>> = [];
        private processing = false;
        private requestCount = 0;
        private readonly MAX_RPM = 60;
        private resetInterval: NodeJS.Timeout | null = null;

        constructor() {
          this.startResetTimer();
        }

        private startResetTimer(): void {
          this.resetInterval = setInterval(() => {
            this.requestCount = 0;
            this.processQueue();
          }, 60000);
        }

        async add<T>(fn: () => Promise<T>): Promise<T> {
          return new Promise((resolve, reject) => {
            this.queue.push(async () => {
              try {
                const result = await fn();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            });
            
            this.processQueue();
          });
        }

        private async processQueue(): Promise<void> {
          if (this.processing || this.queue.length === 0) return;
          
          this.processing = true;
          
          while (this.queue.length > 0 && this.requestCount < this.MAX_RPM) {
            const fn = this.queue.shift();
            if (fn) {
              this.requestCount++;
              await fn();
            }
          }
          
          this.processing = false;
        }

        destroy(): void {
          if (this.resetInterval) {
            clearInterval(this.resetInterval);
          }
        }
      }

      const queue = new RequestQueue();
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'result' } });

      // Add 70 requests (exceeds 60/min limit)
      const promises = Array.from({ length: 70 }, () =>
        queue.add(() => model.generateContent('test'))
      );

      // First 60 should be processed immediately, remaining 10 queued
      const results = await Promise.all(promises);
      expect(results).toHaveLength(70);
      
      queue.destroy();
    });
  });

  describe('Concurrent Request Management', () => {
    it('should limit concurrent requests to avoid rate limits', async () => {
      class ConcurrentLimiter {
        private running = 0;
        private readonly maxConcurrent = 5;
        private queue: Array<() => void> = [];

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          await this.acquire();
          try {
            return await fn();
          } finally {
            this.release();
          }
        }

        private acquire(): Promise<void> {
          return new Promise(resolve => {
            if (this.running < this.maxConcurrent) {
              this.running++;
              resolve();
            } else {
              this.queue.push(resolve);
            }
          });
        }

        private release(): void {
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            next?.();
          } else {
            this.running--;
          }
        }
      }

      const limiter = new ConcurrentLimiter();
      let concurrentCount = 0;
      let maxConcurrentObserved = 0;

      mockGenerateContent.mockImplementation(async () => {
        concurrentCount++;
        maxConcurrentObserved = Math.max(maxConcurrentObserved, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
        return { response: { text: () => 'result' } };
      });

      // Run 20 concurrent requests
      await Promise.all(
        Array.from({ length: 20 }, () =>
          limiter.execute(() => model.generateContent('test'))
        )
      );

      expect(maxConcurrentObserved).toBeLessThanOrEqual(5);
    });
  });

  describe('Usage Reporting', () => {
    it('should calculate estimated requests for video analysis', () => {
      const calculateVideoAnalysisRequests = (
        frameCount: number,
        requestsPerFrame: number = 1
      ) => {
        const totalRequests = frameCount * requestsPerFrame;
        const batchesNeeded = Math.ceil(totalRequests / 60); // 60 req/min limit
        const estimatedTimeMinutes = batchesNeeded;

        return {
          frameCount,
          totalRequests,
          batchesNeeded,
          estimatedTimeMinutes,
          withinFreeTier: totalRequests <= 60, // Single batch
        };
      };

      // Test scenarios
      const scenarios = [
        { frames: 5, expectedBatches: 1, expectedTime: 1 },
        { frames: 30, expectedBatches: 1, expectedTime: 1 },
        { frames: 60, expectedBatches: 1, expectedTime: 1 },
        { frames: 90, expectedBatches: 2, expectedTime: 2 },
        { frames: 180, expectedBatches: 3, expectedTime: 3 },
      ];

      scenarios.forEach(({ frames, expectedBatches, expectedTime }) => {
        const estimate = calculateVideoAnalysisRequests(frames);
        expect(estimate.batchesNeeded).toBe(expectedBatches);
        expect(estimate.estimatedTimeMinutes).toBe(expectedTime);
      });
    });

    it('should calculate daily capacity for typical usage', () => {
      const calculateDailyCapacity = (
        jobsPerDay: number,
        framesPerJob: number = 10
      ) => {
        const requestsPerJob = framesPerJob;
        const totalRequests = jobsPerDay * requestsPerJob;
        const dailyLimit = 60 * 60 * 24; // 60 req/min * 60 min * 24 hours = theoretical max
        const realisticLimit = 60 * 60 * 8; // Assume 8 hours of operation

        return {
          jobsPerDay,
          framesPerJob,
          totalRequests,
          withinHourlyLimit: totalRequests <= 3600, // 60 * 60
          withinRealisticDailyLimit: totalRequests <= realisticLimit,
          estimatedHours: Math.ceil(totalRequests / 3600),
        };
      };

      const scenarios = [
        { jobs: 10, frames: 10, expectedHours: 1 },   // 100 requests
        { jobs: 50, frames: 10, expectedHours: 1 },  // 500 requests
        { jobs: 100, frames: 10, expectedHours: 1 }, // 1000 requests
        { jobs: 300, frames: 10, expectedHours: 1 }, // 3000 requests
        { jobs: 500, frames: 10, expectedHours: 2 }, // 5000 requests
      ];

      scenarios.forEach(({ jobs, frames, expectedHours }) => {
        const capacity = calculateDailyCapacity(jobs, frames);
        expect(capacity.estimatedHours).toBe(expectedHours);
        expect(capacity.withinRealisticDailyLimit).toBe(true);
      });
    });
  });
});
