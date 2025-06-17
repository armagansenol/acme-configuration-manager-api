import rateLimit from "express-rate-limit"
import { Request, Response } from "express"
import { logger } from "../utils/logger"
import { RateLimitError } from "../types/errors"

/**
 * Rate limiting configuration for different endpoint types
 */

// General API rate limiting
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.security(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
      method: req.method,
    })

    res.status(429).json({
      error: "Too many requests",
      message: "Too many requests from this IP, please try again later.",
      retryAfter: 900, // 15 minutes in seconds
    })
  },
})

// Stricter rate limiting for admin operations (CRUD operations)
export const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: {
    error: "Too many admin requests",
    message: "Too many admin requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.security(`Admin rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
      method: req.method,
      operation: "admin",
    })

    res.status(429).json({
      error: "Too many admin requests",
      message: "Too many admin requests from this IP, please try again later.",
      retryAfter: 900, // 15 minutes in seconds
    })
  },
})

// More lenient rate limiting for client configuration endpoint
export const clientConfigLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Allow more frequent requests for client config
  message: {
    error: "Too many configuration requests",
    message: "Too many configuration requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.security(`Client config rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
      method: req.method,
      operation: "client_config",
    })

    res.status(429).json({
      error: "Too many configuration requests",
      message: "Too many configuration requests, please try again later.",
      retryAfter: 60, // 1 minute in seconds
    })
  },
})

// Very strict rate limiting for sensitive operations (delete)
export const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Only 10 delete operations per hour
  message: {
    error: "Too many sensitive operations",
    message: "Too many sensitive operations from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.securityEvent(
      "Sensitive operation rate limit exceeded",
      {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        operation: "sensitive",
      },
      "high"
    )

    res.status(429).json({
      error: "Too many sensitive operations",
      message: "Too many sensitive operations from this IP, please try again later.",
      retryAfter: 3600, // 1 hour in seconds
    })
  },
})

/**
 * Custom rate limiter that can be configured per endpoint
 */
export const createCustomRateLimiter = (options: {
  windowMs: number
  max: number
  message: string
  operation: string
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: "Rate limit exceeded",
      message: options.message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.security(`Custom rate limit exceeded for operation: ${options.operation}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        operation: options.operation,
      })

      res.status(429).json({
        error: "Rate limit exceeded",
        message: options.message,
        retryAfter: Math.round(options.windowMs / 1000),
      })
    },
  })
}

/**
 * Rate limiting middleware that throws our custom error
 */
export const createRateLimitErrorMiddleware = (limiter: any) => {
  return (req: Request, res: Response, next: any) => {
    limiter(req, res, (err: any) => {
      if (err) {
        throw new RateLimitError("Rate limit exceeded")
      }
      next()
    })
  }
}
