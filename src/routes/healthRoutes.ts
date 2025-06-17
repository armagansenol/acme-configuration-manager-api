import { Router } from "express"
import { healthService } from "../services/healthService"
import { cacheService } from "../services/cacheService"
import { logger } from "../utils/logger"

const router = Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Comprehensive health check
 *     description: Returns the detailed health status of all integrated services.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The service is healthy or degraded, but operational.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *       503:
 *         description: The service is unhealthy and not operational.
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
 * @swagger
 * /health/quick:
 *   get:
 *     summary: Quick health check
 *     description: A lightweight endpoint for load balancers to quickly determine if the service is up.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The service is up.
 *       503:
 *         description: The service is down.
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
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: For Kubernetes, to determine if the container is ready to handle traffic.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The service is ready for traffic.
 *       503:
 *         description: The service is not ready for traffic.
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
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: For Kubernetes, to determine if the container is still running.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The service is alive.
 *       503:
 *         description: The service is not alive and should be restarted.
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
 * @swagger
 * /health/cache:
 *   get:
 *     summary: Cache health and statistics
 *     description: Returns the health status and performance statistics of the cache service.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Cache is healthy.
 *       503:
 *         description: Cache is unhealthy.
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
 * @swagger
 * /metrics:
 *   get:
 *     summary: System metrics
 *     description: Provides key system metrics like memory and CPU usage.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System metrics.
 *       500:
 *         description: Failed to retrieve metrics.
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
