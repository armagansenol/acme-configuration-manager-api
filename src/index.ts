/**
 * ACME Configuration Manager API
 * Entry point for the application
 */

import { config } from "dotenv"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import morgan from "morgan"
import { logger } from "./utils/logger"
import configRoutes from "./routes/configRoutes"

// Load environment variables FIRST
config()

// Basic environment check
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development"
}

logger.startup("ACME Configuration Manager API starting...")
logger.startup(`Environment: ${process.env.NODE_ENV}`)

// Initialize Firebase
import "./config/firebase"

// Create Express app
const app = express()
const PORT = parseInt(process.env.PORT || "3000", 10)

// Security middleware
app.use(helmet())

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
}
app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

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
      stream: { write: (message) => logger.info(message.trim()) },
      skip: (req) => {
        // Skip logging for health checks and sensitive endpoints
        return req.url === "/health"
      },
    })
  )
} else {
  // Production: Security-conscious logging without sensitive headers
  morgan.token("sanitized-headers", (req) => {
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
      stream: { write: (message) => logger.info(message.trim()) },
      skip: (req) => {
        // Skip logging for health checks
        return req.url === "/health"
      },
    })
  )
}

// Root endpoint - API documentation
app.get("/", (req, res) => {
  res.status(200).json({
    name: "ACME Configuration Manager API",
    version: "1.0.0",
    description: "A robust configuration management API for dynamic application parameters",
    endpoints: {
      health: "GET /health - Health check",
      parameters: {
        list: "GET /api/parameters - Get all parameters (Firebase Auth required)",
        create: "POST /api/parameters - Create parameter (Firebase Auth required)",
        update: "PUT /api/parameters/:id - Update parameter (Firebase Auth required)",
        delete: "DELETE /api/parameters/:id - Delete parameter (Firebase Auth required)",
      },
      clientConfig: "GET /api/client-config - Get client configuration (API Key required in x-api-key header)",
    },
    authentication: {
      firebase: "Include 'Authorization: Bearer <firebase-token>' header",
      apiKey: "Include 'x-api-key: <your-api-key>' header",
    },
  })
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    // Removed environment info for security
  })
})

// API routes
app.use("/api", configRoutes)

// Enhanced error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Generate unique error ID for tracking
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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

// Start server (for Cloud Run and local development)
// Cloud Run requires binding to 0.0.0.0 on the PORT environment variable
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost"

app.listen(PORT, HOST, () => {
  logger.startup(`🚀 Server running on ${HOST}:${PORT}`)
  logger.startup("📡 API endpoints available:")
  logger.startup("  GET  /health - Health check")
  logger.startup("  GET  /api/parameters - Get all parameters (Firebase Auth)")
  logger.startup("  POST /api/parameters - Create parameter (Firebase Auth)")
  logger.startup("  PUT  /api/parameters/:id - Update parameter (Firebase Auth)")
  logger.startup("  DELETE /api/parameters/:id - Delete parameter (Firebase Auth)")
  logger.startup("  GET  /api/client-config - Get client config (API Key)")
})

export default app
