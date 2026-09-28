import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Separate connections: BullMQ needs maxRetriesPerRequest: null, plain
// counters don't - keeping them apart avoids surprising BullMQ.
export const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
export const rateLimitRedis = new Redis(redisUrl);
