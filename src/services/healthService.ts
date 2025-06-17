import { admin, db } from "../config/firebase"
import { cacheService } from "./cacheService"
import { logger } from "../utils/logger"

/**
 * Health check status interface
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  uptime: number
  version: string
  services: {
    database: ServiceHealth
    cache: ServiceHealth
    authentication: ServiceHealth
  }
  metrics: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    process: {
      pid: number
      uptime: number
    }
  }
}

interface ServiceHealth {
  status: "healthy" | "unhealthy"
  latency?: number
  details?: any
  error?: string
}

/**
 * Health check service for monitoring system status
 */
export class HealthService {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()

      // Test database connectivity by getting a small collection
      const testCollection = db.collection("health_check")
      await testCollection.limit(1).get()

      const latency = Date.now() - startTime

      return {
        status: "healthy",
        latency,
        details: {
          type: "firestore",
          region: process.env.FIREBASE_PROJECT_ID || "unknown",
        },
      }
    } catch (error) {
      logger.errorWithContext("Database health check failed", error)
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown database error",
      }
    }
  }

  /**
   * Check cache service connectivity and performance
   */
  private async checkCache(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()
      const healthCheck = await cacheService.healthCheck()
      const latency = Date.now() - startTime

      return {
        status: healthCheck.status === "healthy" ? "healthy" : "unhealthy",
        latency,
        details: healthCheck.details,
      }
    } catch (error) {
      logger.errorWithContext("Cache health check failed", error)
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown cache error",
      }
    }
  }

  /**
   * Check Firebase Authentication service
   */
  private async checkAuthentication(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()

      // Test Firebase Auth by listing users (with limit to avoid performance issues)
      await admin.auth().listUsers(1)

      const latency = Date.now() - startTime

      return {
        status: "healthy",
        latency,
        details: {
          service: "firebase_auth",
        },
      }
    } catch (error) {
      logger.errorWithContext("Authentication health check failed", error)
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown authentication error",
      }
    }
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics() {
    const memUsage = process.memoryUsage()

    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      process: {
        pid: process.pid,
        uptime: Math.round(process.uptime()),
      },
    }
  }

  /**
   * Determine overall system status based on service health
   */
  private determineOverallStatus(services: HealthStatus["services"]): HealthStatus["status"] {
    const serviceStatuses = Object.values(services).map((service) => service.status)

    if (serviceStatuses.every((status) => status === "healthy")) {
      return "healthy"
    }

    if (serviceStatuses.some((status) => status === "healthy")) {
      return "degraded"
    }

    return "unhealthy"
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString()
    const uptime = Date.now() - this.startTime

    try {
      // Run all health checks in parallel for better performance
      const [database, cache, authentication] = await Promise.all([
        this.checkDatabase(),
        this.checkCache(),
        this.checkAuthentication(),
      ])

      const services = {
        database,
        cache,
        authentication,
      }

      const status = this.determineOverallStatus(services)
      const metrics = this.getSystemMetrics()

      const healthStatus: HealthStatus = {
        status,
        timestamp,
        uptime,
        version: process.env.npm_package_version || "unknown",
        services,
        metrics,
      }

      // Log health check results
      if (status === "healthy") {
        logger.debug("Health check completed - system healthy")
      } else if (status === "degraded") {
        logger.warn("Health check completed - system degraded", { services })
      } else {
        logger.error("Health check completed - system unhealthy", { services })
      }

      return healthStatus
    } catch (error) {
      logger.errorWithContext("Health check failed", error)

      return {
        status: "unhealthy",
        timestamp,
        uptime,
        version: process.env.npm_package_version || "unknown",
        services: {
          database: { status: "unhealthy", error: "Health check failed" },
          cache: { status: "unhealthy", error: "Health check failed" },
          authentication: { status: "unhealthy", error: "Health check failed" },
        },
        metrics: this.getSystemMetrics(),
      }
    }
  }

  /**
   * Quick health check for load balancer/monitoring
   */
  async quickCheck(): Promise<{ status: "ok" | "error"; timestamp: string }> {
    try {
      // Simple database ping
      await db.collection("health_check").limit(1).get()

      return {
        status: "ok",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.errorWithContext("Quick health check failed", error)
      return {
        status: "error",
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get service readiness status (for Kubernetes readiness probes)
   */
  async checkReadiness(): Promise<{ ready: boolean; details: any }> {
    try {
      // Check if essential services are available
      const [dbCheck, cacheCheck] = await Promise.all([this.checkDatabase(), this.checkCache()])

      const ready = dbCheck.status === "healthy" && cacheCheck.status === "healthy"

      return {
        ready,
        details: {
          database: dbCheck.status,
          cache: cacheCheck.status,
        },
      }
    } catch (error) {
      logger.errorWithContext("Readiness check failed", error)
      return {
        ready: false,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }
  }

  /**
   * Get service liveness status (for Kubernetes liveness probes)
   */
  async checkLiveness(): Promise<{ alive: boolean; uptime: number }> {
    const uptime = Date.now() - this.startTime

    // Simple check - if process is running and hasn't crashed
    return {
      alive: true,
      uptime,
    }
  }
}

// Export singleton instance
export const healthService = new HealthService()
