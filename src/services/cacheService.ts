import { createClient, RedisClientType } from "redis"
import { logger } from "../utils/logger"
import { CacheError, ConfigurationError } from "../types/errors"

/**
 * Redis-based cache service for configuration data
 * Uses TTL-based expiration and provides fallback mechanisms
 */
export class CacheService {
  private client: RedisClientType
  private defaultTTL: number
  private isConnected: boolean = false

  constructor(defaultTTL: number = 5 * 60) {
    // Default TTL: 5 minutes (Redis expects seconds)
    this.defaultTTL = defaultTTL

    // Create Redis client
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 5000,
      },
    })

    // Set up event handlers
    this.client.on("error", (error) => {
      logger.error("Redis client error:", error)
      this.isConnected = false
    })

    this.client.on("connect", () => {
      logger.info("Redis client connected")
      this.isConnected = true
    })

    this.client.on("disconnect", () => {
      logger.warn("Redis client disconnected")
      this.isConnected = false
    })
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect()
        logger.startup("Redis cache service connected")
      }
    } catch (error) {
      logger.errorWithContext("Failed to connect to Redis", error)
      throw new ConfigurationError("Redis connection failed")
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect()
        logger.info("Redis cache service disconnected")
      }
    } catch (error) {
      logger.errorWithContext("Failed to disconnect from Redis", error)
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const value = await this.client.get(key)

      if (!value) {
        logger.debug(`Cache miss for key: ${key}`)
        return null
      }

      logger.debug(`Cache hit for key: ${key}`)
      return JSON.parse(value) as T
    } catch (error) {
      logger.errorWithContext("Cache get operation failed", error, { key })

      // Return null instead of throwing to allow fallback to database
      logger.warn(`Cache fallback: returning null for key ${key}`)
      return null
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const serializedData = JSON.stringify(data)
      const expirationTime = ttl || this.defaultTTL

      await this.client.setEx(key, expirationTime, serializedData)
      logger.debug(`Cache set for key: ${key}, TTL: ${expirationTime}s`)
    } catch (error) {
      logger.errorWithContext("Cache set operation failed", error, { key, ttl })

      // Don't throw to prevent cache errors from breaking the application
      logger.warn(`Cache set failed for key ${key}, continuing without cache`)
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const result = await this.client.del(key)
      const deleted = result > 0

      if (deleted) {
        logger.debug(`Cache deleted for key: ${key}`)
      }
      return deleted
    } catch (error) {
      logger.errorWithContext("Cache delete operation failed", error, { key })
      return false
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      await this.client.flushDb()
      logger.info("Cache cleared: all entries removed")
    } catch (error) {
      logger.errorWithContext("Cache clear operation failed", error)
      throw new CacheError("Failed to clear cache", "clear")
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keyCount: number; memoryUsage?: string; uptime?: number }> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const info = await this.client.info("memory")
      const keyCount = await this.client.dbSize()

      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/)
      const memoryUsage = memoryMatch ? memoryMatch[1] : undefined

      return {
        keyCount,
        ...(memoryUsage && { memoryUsage }),
        ...(this.isConnected && { uptime: Date.now() }),
      }
    } catch (error) {
      logger.errorWithContext("Failed to get cache stats", error)
      return { keyCount: 0 }
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const exists = await this.client.exists(key)
      return exists === 1
    } catch (error) {
      logger.errorWithContext("Cache exists check failed", error, { key })
      return false
    }
  }

  /**
   * Get or set pattern - fetch from cache, or execute function and cache result
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key)
      if (cached !== null) {
        return cached
      }

      // If not in cache, fetch and cache
      logger.debug(`Cache miss for key: ${key}, fetching data`)
      const data = await fetchFn()
      await this.set(key, data, ttl)
      return data
    } catch (error) {
      logger.errorWithContext("Cache getOrSet operation failed", error, { key })

      // Fallback to direct fetch if cache fails
      logger.warn(`Cache getOrSet fallback: fetching data directly for key ${key}`)
      return await fetchFn()
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      const result = await this.client.expire(key, ttl)
      logger.debug(`TTL set for key: ${key}, TTL: ${ttl}s`)
      return result
    } catch (error) {
      logger.errorWithContext("Cache expire operation failed", error, { key, ttl })
      return false
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      return await this.client.ttl(key)
    } catch (error) {
      logger.errorWithContext("Cache TTL check failed", error, { key })
      return -1
    }
  }

  /**
   * Invalidate cache entries by pattern using SCAN for production safety
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      let cursor = 0
      let deletedCount = 0

      do {
        // Use SCAN to iterate over keys without blocking the server
        const reply = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100, // Process 100 keys per iteration
        })

        if (reply.keys.length > 0) {
          deletedCount += await this.client.del(reply.keys)
        }

        cursor = reply.cursor
      } while (cursor !== 0)

      logger.info(`Pattern invalidation completed: ${deletedCount} entries removed for pattern: ${pattern}`)
      return deletedCount
    } catch (error) {
      logger.errorWithContext("Cache pattern invalidation failed", error, { pattern })
      return 0
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; details: any }> {
    try {
      if (!this.isConnected) {
        await this.connect()
      }

      await this.client.ping()
      const stats = await this.getStats()

      return {
        status: "healthy",
        details: {
          connected: this.isConnected,
          ...stats,
        },
      }
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()

// Cache key generators
export const CacheKeys = {
  CLIENT_CONFIG: (country?: string) => `acme:config:client:${country || "default"}`,
  PARAMETER: (id: string) => `acme:parameter:${id}`,
  PARAMETERS_LIST: () => "acme:parameters:list",
  USER_EMAIL: (uid: string) => `acme:user:email:${uid}`,
  HEALTH: () => "acme:health:cache",
} as const
