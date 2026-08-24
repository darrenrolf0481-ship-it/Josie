import Redis from "ioredis";

/**
 * In-memory token-bucket rate limiter used as fallback when Redis is unavailable.
 * Lightweight — no external deps.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// ─── Redis-backed token bucket  ───────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 2) return null; // stop retrying after 2 attempts
          return Math.min(times * 200, 1000);
        },
      });
      redis.on("error", (err) => {
        console.warn("[rateLimit] Redis connection error, falling back to in-memory:", err.message);
        redis = null;
      });
      return redis;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Token bucket rate limiter.
 * Uses Redis (with Lua scripting for atomicity) when REDIS_URL is set,
 * falls back to in-memory otherwise.
 */
export async function checkRateLimit(toolName: string, identity = "anonymous"): Promise<{
  allowed: boolean;
  remaining: number;
  message?: string;
}> {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return { allowed: true, remaining: 999 };
  }

  const maxTokens = getToolMaxTokens(toolName);
  const refillRate = getToolRefillRate(toolName);

  const redisClient = getRedis();
  if (redisClient) {
    return redisRateLimit(redisClient, toolName, maxTokens, refillRate, identity);
  }

  // Fallback to in-memory
  return inMemoryRateLimit(`${identity}:${toolName}`, maxTokens, refillRate);
}

// ─── Tool-specific limits  ─────────────────────────────────────

function getToolMaxTokens(toolName: string): number {
  switch (toolName) {
    case "execute_code":
      return 30;
    case "fetch_url":
      return 20;
    default:
      return 60;
  }
}

function getToolRefillRate(toolName: string): number {
  // tokens per second
  switch (toolName) {
    case "execute_code":
      return 0.5; // 30 tokens / 60 seconds
    case "fetch_url":
      return 0.33; // ~1 per 3 seconds
    default:
      return 1.0; // 60 tokens / 60 seconds
  }
}

// ─── In-memory fallback  ───────────────────────────────────────

const memoryLimiters: Map<string, TokenBucket> = new Map();

function inMemoryRateLimit(
  toolName: string,
  maxTokens: number,
  refillRate: number
): { allowed: boolean; remaining: number; message?: string } {
  if (!memoryLimiters.has(toolName)) {
    memoryLimiters.set(toolName, new TokenBucket(maxTokens, refillRate));
  }

  const limiter = memoryLimiters.get(toolName)!;
  const allowed = limiter.tryConsume();
  const remaining = Math.floor(limiter.availableTokens());

  return {
    allowed,
    remaining,
    message: allowed
      ? undefined
      : `Rate limit exceeded for tool "${toolName}". Try again shortly. (${remaining} tokens remaining)`,
  };
}

// ─── Redis Lua implementation  ──────────────────────────────────

/**
 * Lua script for atomic token-bucket in Redis.
 * KEYS[1] - bucket key
 * ARGV[1] - max tokens
 * ARGV[2] - refill rate (tokens/sec)
 * ARGV[3] - current timestamp in seconds
 * ARGV[4] - tokens to consume
 *
 * Returns: [allowed (0|1), remaining_tokens]
 */
const TOKEN_BUCKET_SCRIPT = `
local key       = KEYS[1]
local maxTokens = tonumber(ARGV[1])
local rate      = tonumber(ARGV[2])
local now       = tonumber(ARGV[3])
local consume   = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or maxTokens
local lastRefill = tonumber(bucket[2]) or now

-- Refill
local elapsed = now - lastRefill
tokens = math.min(maxTokens, tokens + elapsed * rate)
lastRefill = now

-- Consume
local allowed = 0
if tokens >= consume then
  tokens = tokens - consume
  allowed = 1
end

-- Persist state
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
redis.call('EXPIRE', key, 3600)

return {allowed, math.floor(tokens)}
`;

async function redisRateLimit(
  client: Redis,
  toolName: string,
  maxTokens: number,
  refillRate: number,
  identity: string
): Promise<{ allowed: boolean; remaining: number; message?: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const key = `ratelimit:${identity}:${toolName}`;

    const result = (await client.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      maxTokens,
      refillRate,
      now,
      1 // consume 1 token
    )) as [number, number];

    const allowed = result[0] === 1;
    const remaining = result[1];

    return {
      allowed,
      remaining,
      message: allowed
        ? undefined
        : `Rate limit exceeded for tool "${toolName}". Try again shortly. (${remaining} tokens remaining)`,
    };
  } catch (err: any) {
    console.warn(`[rateLimit] Redis error, falling back to in-memory: ${err.message}`);
    return inMemoryRateLimit(`${identity}:${toolName}`, maxTokens, refillRate);
  }
}

export async function getAllRateLimitStatus(): Promise<Record<string, number>> {
  const redisClient = getRedis();
  const toolNames = ["execute_code", "fetch_url"];

  if (redisClient) {
    const status: Record<string, number> = {};
    try {
      for (const name of toolNames) {
        const key = `ratelimit:anonymous:${name}`;
        const bucket = await redisClient.hmget(key, "tokens");
        status[name] = Math.floor(Number(bucket[0]) || getToolMaxTokens(name));
      }
      return status;
    } catch {
      // fall through to memory
    }
  }

  const status: Record<string, number> = {};
  for (const name of memoryLimiters.keys()) {
    status[name] = Math.floor(memoryLimiters.get(name)!.availableTokens());
  }
  return status;
}