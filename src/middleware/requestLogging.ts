import { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"
import { AuthenticatedRequest } from "../types"

/**
 * Request/Response logging middleware for debugging and monitoring
 */

interface LoggingOptions {
  includeBody?: boolean
  includeHeaders?: boolean
  includeQuery?: boolean
  maxBodySize?: number
  excludePaths?: string[]
  sensitiveHeaders?: string[]
}

// Default sensitive headers to exclude from logs
const DEFAULT_SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key", "x-auth-token", "authentication"]

/**
 * Sanitize headers by removing sensitive information
 */
function sanitizeHeaders(headers: any, sensitiveHeaders: string[] = DEFAULT_SENSITIVE_HEADERS): any {
  const sanitized: any = {}

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase()

    if (sensitiveHeaders.includes(keyLower)) {
      sanitized[key] = "[REDACTED]"
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Sanitize request body by removing sensitive information
 */
function sanitizeBody(body: any, maxSize: number = 1000): any {
  if (!body) return body

  let sanitized = { ...body }

  // Remove sensitive fields
  const sensitiveFields = ["password", "token", "secret", "key", "auth"]
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]"
    }
  }

  // Truncate large bodies
  const bodyStr = JSON.stringify(sanitized)
  if (bodyStr.length > maxSize) {
    return {
      _truncated: true,
      _originalSize: bodyStr.length,
      _preview: bodyStr.substring(0, maxSize) + "...",
    }
  }

  return sanitized
}

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    "unknown"
  )
}

/**
 * Create request logging middleware
 */
export function createRequestLogger(options: LoggingOptions = {}) {
  const {
    includeBody = true,
    includeHeaders = false,
    includeQuery = true,
    maxBodySize = 1000,
    excludePaths = [],
    sensitiveHeaders = DEFAULT_SENSITIVE_HEADERS,
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = Math.random().toString(36).substring(7)

    // Skip logging for excluded paths
    if (excludePaths.some((path) => req.path.includes(path))) {
      return next()
    }

    // Add request ID to request object for tracking
    ;(req as any).requestId = requestId

    // Log incoming request
    const requestLog: any = {
      requestId,
      method: req.method,
      path: req.path,
      url: req.url,
      ip: getClientIP(req),
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    }

    // Add authenticated user info if available
    if ((req as AuthenticatedRequest).user) {
      requestLog.userId = (req as AuthenticatedRequest).user!.uid
      requestLog.userEmail = (req as AuthenticatedRequest).user!.email
    }

    // Include query parameters if requested
    if (includeQuery && Object.keys(req.query).length > 0) {
      requestLog.query = req.query
    }

    // Include headers if requested
    if (includeHeaders) {
      requestLog.headers = sanitizeHeaders(req.headers, sensitiveHeaders)
    }

    // Include body if requested
    if (includeBody && req.body && Object.keys(req.body).length > 0) {
      requestLog.body = sanitizeBody(req.body, maxBodySize)
    }

    logger.api(`Incoming ${req.method} ${req.path}`, requestLog)

    // Capture original res.json to log responses
    const originalJson = res.json

    res.json = function (body: any) {
      const endTime = Date.now()
      const duration = endTime - startTime

      // Log response
      const responseLog: any = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
      }

      // Add response body for non-200 responses or if explicitly requested
      if (res.statusCode >= 400 || (includeBody && res.statusCode < 300)) {
        responseLog.responseBody = sanitizeBody(body, maxBodySize)
      }

      // Log based on status code
      if (res.statusCode >= 500) {
        logger.error(`Response ${req.method} ${req.path} - ${res.statusCode}`, responseLog)
      } else if (res.statusCode >= 400) {
        logger.warn(`Response ${req.method} ${req.path} - ${res.statusCode}`, responseLog)
      } else {
        logger.api(`Response ${req.method} ${req.path} - ${res.statusCode}`, responseLog)
      }

      return originalJson.call(this, body)
    }

    // Log errors if response ends without calling json
    res.on("finish", () => {
      if (!res.headersSent) {
        const endTime = Date.now()
        const duration = endTime - startTime

        logger.warn(`Request completed without response - ${req.method} ${req.path}`, {
          requestId,
          duration,
          statusCode: res.statusCode,
        })
      }
    })

    next()
  }
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(error: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).requestId || "unknown"

  const errorLog: any = {
    requestId,
    method: req.method,
    path: req.path,
    url: req.url,
    ip: getClientIP(req),
    userAgent: req.get("User-Agent"),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    },
    timestamp: new Date().toISOString(),
  }

  // Add user context if available
  if ((req as AuthenticatedRequest).user) {
    errorLog.userId = (req as AuthenticatedRequest).user!.uid
  }

  logger.errorWithContext(`Unhandled error in ${req.method} ${req.path}`, error, errorLog)

  // Don't call next() here if you want to handle the error
  // Call next(error) to pass to other error handlers
  next(error)
}

/**
 * Performance logging middleware for slow requests
 */
export function performanceLoggingMiddleware(slowThreshold: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()

    res.on("finish", () => {
      const duration = Date.now() - startTime

      if (duration > slowThreshold) {
        const requestId = (req as any).requestId || "unknown"

        logger.warn(`Slow request detected - ${req.method} ${req.path}`, {
          requestId,
          duration,
          threshold: slowThreshold,
          statusCode: res.statusCode,
          ip: getClientIP(req),
          userAgent: req.get("User-Agent"),
        })
      }
    })

    next()
  }
}

/**
 * Rate limit logging middleware
 */
export function rateLimitLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if request is rate limited
  const rateLimitHeaders = {
    limit: res.get("X-RateLimit-Limit") || res.get("RateLimit-Limit"),
    remaining: res.get("X-RateLimit-Remaining") || res.get("RateLimit-Remaining"),
    reset: res.get("X-RateLimit-Reset") || res.get("RateLimit-Reset"),
  }

  if (rateLimitHeaders.limit) {
    const requestId = (req as any).requestId || "unknown"

    logger.debug(`Rate limit info for ${req.method} ${req.path}`, {
      requestId,
      ip: getClientIP(req),
      rateLimit: rateLimitHeaders,
    })

    // Warn if close to rate limit
    if (rateLimitHeaders.remaining && parseInt(rateLimitHeaders.remaining) < 5) {
      logger.warn(`Rate limit threshold approaching - ${req.method} ${req.path}`, {
        requestId,
        ip: getClientIP(req),
        remaining: rateLimitHeaders.remaining,
        limit: rateLimitHeaders.limit,
      })
    }
  }

  next()
}

/**
 * Default request logger with sensible defaults for this application
 */
export const defaultRequestLogger = createRequestLogger({
  includeBody: true,
  includeHeaders: false, // Set to true in development if needed
  includeQuery: true,
  maxBodySize: 1000,
  excludePaths: ["/health", "/metrics"], // Exclude health check endpoints
  sensitiveHeaders: DEFAULT_SENSITIVE_HEADERS,
})
