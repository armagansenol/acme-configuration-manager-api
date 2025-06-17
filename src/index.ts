/**
 * ACME Configuration Manager API
 * Entry point for the application
 */

console.log("Starting application initialization...")

import { config } from "dotenv"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import morgan from "morgan"
import { logger } from "./utils/logger"
import configRoutes from "./routes/configRoutes"
import healthRoutes from "./routes/healthRoutes"
import { cacheService } from "./services/cacheService"
import { healthService } from "./services/healthService"
import { errorLoggingMiddleware } from "./middleware/requestLogging"
import { isCustomError } from "./types/errors"

// Load environment variables FIRST
config()

// Basic environment check
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development"
}

logger.startup("ACME Configuration Manager API starting...")
logger.startup(`Environment: ${process.env.NODE_ENV}`)

// Initialize Firebase - this will run immediately when imported
logger.startup("Initializing Firebase...")
import "./config/firebase"
logger.startup("Firebase initialization completed")

// Initialize cache service
const initializeServices = async () => {
  try {
    logger.startup("Attempting to connect to cache service...")
    await cacheService.connect()
    logger.startup("Cache service initialized successfully")
  } catch (error) {
    logger.errorWithContext("Failed to initialize cache service", error)
    logger.startup("Continuing without cache service - using fallbacks")
    // Continue without cache - the service will handle fallbacks
  }
}

// Create Express app
const app = express()
const PORT = parseInt(process.env.PORT || "3000", 10)

// Trust proxy setting - required for Render and other proxy environments
// This allows express-rate-limit to correctly identify users behind proxies
app.set("trust proxy", 1)

// Security middleware
app.use(helmet())

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) || [
  "http://localhost:5173",
]
logger.startup(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`)

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    // Check if the origin (with or without trailing slash) is allowed
    const isAllowed = allowedOrigins.some((allowedOrigin) => {
      const normalizedOrigin = origin.replace(/\/$/, "") // Remove trailing slash
      const normalizedAllowed = allowedOrigin.replace(/\/$/, "") // Remove trailing slash
      return normalizedOrigin === normalizedAllowed
    })

    if (isAllowed) {
      callback(null, true)
    } else {
      logger.warn(`CORS blocked for origin: ${origin}. Allowed origins: ${JSON.stringify(allowedOrigins)}`)
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
}
app.use(cors(corsOptions))

// Compression
app.use(compression())

// Body parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// HTTP request logging with security considerations
const isDevelopment = process.env.NODE_ENV === "development"

if (isDevelopment) {
  // Development: More detailed logging
  app.use(
    morgan("dev", {
      stream: { write: (message: string) => logger.info(message.trim()) },
      skip: (req: express.Request) => {
        // Skip logging for health checks and sensitive endpoints
        return req.url === "/health"
      },
    })
  )
} else {
  // Production: Security-conscious logging without sensitive headers
  morgan.token("sanitized-headers", (req: express.Request) => {
    const headers = { ...req.headers }
    // Remove sensitive headers from logs
    delete headers.authorization
    delete headers.cookie
    delete headers["x-api-key"]
    delete headers["x-auth-token"]
    return JSON.stringify(headers)
  })

  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      stream: { write: (message: string) => logger.info(message.trim()) },
      skip: (req: express.Request) => {
        // Skip logging for health checks
        return req.url === "/health"
      },
    })
  )
}

// Simple health check for immediate response during startup
app.get("/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Root endpoint - API documentation
app.get("/", (req, res) => {
  res.status(200).json({
    name: "ACME Configuration Manager API",
    version: "1.0.0",
    description: "A robust configuration management API for dynamic application parameters",
    features: {
      conflictDetection: "Version-based optimistic locking",
      countryOverrides: "Localized configuration support",
      realTimeUpdates: "Immediate conflict detection on save",
    },
    endpoints: {
      ping: "GET /ping - Simple health check",
      health: "GET /health - Comprehensive health check",
      parameters: {
        list: "GET /api/parameters - Get all parameters (Firebase Auth required)",
        get: "GET /api/parameters/:id - Get single parameter (Firebase Auth required)",
        create: "POST /api/parameters - Create parameter (Firebase Auth required)",
        update: "PUT /api/parameters/:id - Update parameter with conflict detection (Firebase Auth required)",
        delete: "DELETE /api/parameters/:id - Delete parameter (Firebase Auth required)",
      },
      clientConfig: "GET /api/client-config - Get client configuration (API Key required in x-api-key header)",
    },
    authentication: {
      firebase: "Include 'Authorization: Bearer <firebase-token>' header",
      apiKey: "Include 'x-api-key: <your-api-key>' header",
    },
    conflictResolution: {
      detection: "Automatic on save with lastKnownVersion",
      options: ["forceUpdate: true", "fetch latest and retry", "cancel operation"],
    },
  })
})

// Health check and metrics routes
app.use("/", healthRoutes)

// API routes
app.use("/api", configRoutes)

// Error logging middleware
app.use(errorLoggingMiddleware)

// Enhanced error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Generate unique error ID for tracking
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Handle custom errors with proper status codes
  if (isCustomError(err)) {
    const statusCode = err.statusCode
    const response = {
      error: err.name,
      message: err.message,
      errorId: errorId,
      ...(err.name === "ValidationError" && (err as any).field && { field: (err as any).field }),
    }

    logger.errorWithContext("Custom error", err, {
      errorId,
      url: req.url,
      method: req.method,
      statusCode,
    })

    res.status(statusCode).json(response)
    return
  }

  // Log error with sanitized context
  logger.errorWithContext("Unhandled error", err, {
    errorId,
    url: req.url,
    method: req.method,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  })

  // Security event logging for unexpected errors
  logger.securityEvent(
    "Unhandled Error",
    {
      errorId,
      endpoint: `${req.method} ${req.url}`,
      statusCode: err.status || 500,
    },
    "medium"
  )

  // Determine response based on environment and error type
  const isProduction = process.env.NODE_ENV === "production"
  let statusCode = err.status || err.statusCode || 500
  let response: any = {
    error: "Internal server error",
    errorId: errorId,
  }

  // Handle different types of errors
  if (err.name === "ValidationError") {
    statusCode = 400
    response = {
      error: "Validation error",
      message: isProduction ? "Invalid input provided" : err.message,
      errorId: errorId,
    }
  } else if (err.name === "UnauthorizedError" || statusCode === 401) {
    statusCode = 401
    response = {
      error: "Unauthorized",
      message: "Authentication required",
      errorId: errorId,
    }
  } else if (err.name === "ForbiddenError" || statusCode === 403) {
    statusCode = 403
    response = {
      error: "Forbidden",
      message: "Insufficient permissions",
      errorId: errorId,
    }
  } else if (statusCode >= 500) {
    // Internal server errors - don't leak details in production
    response = {
      error: "Internal server error",
      message: isProduction ? "An unexpected error occurred" : err.message,
      errorId: errorId,
    }
  }

  res.status(statusCode).json(response)
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found", message: "The requested resource was not found." })
})

// Initialize database and start server
async function startServer() {
  try {
    logger.startup("🚀 Starting server...")

    // Start server FIRST to ensure Render detects the open port
    // Cloud Run and Render require binding to 0.0.0.0 on the PORT environment variable
    const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost"

    logger.startup(`Attempting to bind to ${HOST}:${PORT}...`)
    console.log(`BINDING: Attempting to bind to ${HOST}:${PORT}...`)

    const server = app.listen(PORT, HOST, () => {
      console.log(`SUCCESS: Server running on ${HOST}:${PORT}`)
      logger.startup(`🚀 Server running on ${HOST}:${PORT}`)
      logger.startup("📡 API endpoints available:")
      logger.startup("  GET  /health - Comprehensive health check")
      logger.startup("  GET  /health/quick - Quick health check")
      logger.startup("  GET  /health/ready - Readiness probe")
      logger.startup("  GET  /health/live - Liveness probe")
      logger.startup("  GET  /metrics - System metrics")
      logger.startup("  GET  /api/parameters - Get all parameters (Firebase Auth)")
      logger.startup("  GET  /api/parameters/:id - Get single parameter (Firebase Auth)")
      logger.startup("  POST /api/parameters - Create parameter (Firebase Auth)")
      logger.startup("  PUT  /api/parameters/:id - Update parameter with conflict detection (Firebase Auth)")
      logger.startup("  DELETE /api/parameters/:id - Delete parameter (Firebase Auth)")
      logger.startup("  GET  /api/client-config - Get client config (API Key)")
      logger.startup("🔒 Security: Deep validation, rate limiting, and injection protection enabled")
      logger.startup("⚡ Performance: Redis caching and optimized queries enabled")
      logger.startup("📊 Monitoring: Health checks and metrics enabled")

      // Initialize services AFTER server is listening
      logger.startup("Initializing background services...")
      initializeServices()
        .then(() => {
          logger.startup("Background services initialization completed")
          healthService.setServicesReady(true)
        })
        .catch((error) => {
          logger.errorWithContext("Failed to initialize background services", error)
          logger.startup("Continuing without some services - the API will handle fallbacks gracefully")
          // Still mark as ready since server is running
          healthService.setServicesReady(true)
        })
    })

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        logger.errorWithContext(`Port ${PORT} is already in use`, error)
        process.exit(1)
      } else {
        logger.errorWithContext("Server error", error)
        process.exit(1)
      }
    })
  } catch (error) {
    logger.errorWithContext("Failed to start server", error)
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.startup("Graceful shutdown initiated...")

  try {
    // Disconnect cache service
    await cacheService.disconnect()
    logger.startup("Cache service disconnected")
  } catch (error) {
    logger.errorWithContext("Error during cache service shutdown", error)
  }

  process.exit(0)
}

process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)

// Start the server
console.log("About to call startServer()...")
startServer().catch((error) => {
  console.error("CRITICAL ERROR: startServer failed:", error)
  process.exit(1)
})

export default app
