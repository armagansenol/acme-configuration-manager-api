import { Router } from "express"
import { healthService } from "../services/healthService"
import { cacheService } from "../services/cacheService"
import { logger } from "../utils/logger"

const router = Router()

/**
 * Comprehensive health check endpoint
 * Returns detailed status of all services
 */
router.get("/health", async (req, res) => {
  try {
    const healthStatus = await healthService.checkHealth()

    const statusCode = healthStatus.status === "healthy" ? 200 : healthStatus.status === "degraded" ? 200 : 503

    res.status(statusCode).json(healthStatus)
  } catch (error) {
    logger.errorWithContext("Health check endpoint failed", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    })
  }
})

/**
 * Quick health check for load balancers
 * Simple OK/ERROR response
 */
router.get("/health/quick", async (req, res) => {
  try {
    const result = await healthService.quickCheck()
    res.status(result.status === "ok" ? 200 : 503).json(result)
  } catch (error) {
    logger.errorWithContext("Quick health check failed", error)
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * Readiness probe for Kubernetes
 * Checks if the service is ready to accept traffic
 */
router.get("/health/ready", async (req, res) => {
  try {
    const result = await healthService.checkReadiness()
    res.status(result.ready ? 200 : 503).json(result)
  } catch (error) {
    logger.errorWithContext("Readiness check failed", error)
    res.status(503).json({
      ready: false,
      error: "Readiness check failed",
    })
  }
})

/**
 * Liveness probe for Kubernetes
 * Checks if the service is alive and should not be restarted
 */
router.get("/health/live", async (req, res) => {
  try {
    const result = await healthService.checkLiveness()
    res.status(200).json(result)
  } catch (error) {
    logger.errorWithContext("Liveness check failed", error)
    res.status(503).json({
      alive: false,
      error: "Liveness check failed",
    })
  }
})

/**
 * Cache statistics endpoint
 */
router.get("/health/cache", async (req, res) => {
  try {
    const stats = await cacheService.getStats()
    const healthCheck = await cacheService.healthCheck()

    res.status(healthCheck.status === "healthy" ? 200 : 503).json({
      ...healthCheck,
      stats,
    })
  } catch (error) {
    logger.errorWithContext("Cache health check failed", error)
    res.status(503).json({
      status: "unhealthy",
      error: "Cache health check failed",
    })
  }
})

/**
 * System metrics endpoint
 */
router.get("/metrics", async (req, res) => {
  try {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      cache: await cacheService.getStats(),
    }

    res.status(200).json(metrics)
  } catch (error) {
    logger.errorWithContext("Metrics endpoint failed", error)
    res.status(500).json({
      error: "Failed to collect metrics",
    })
  }
})

export default router
