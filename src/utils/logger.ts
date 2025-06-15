// Centralized logging utility for the backend
// Environment-aware logging with different levels based on NODE_ENV and DEBUG flags

import winston from "winston"

// Environment-aware Winston logger configuration
const isDevelopment = process.env.NODE_ENV === "development"
const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

// Sensitive data patterns to sanitize from logs
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+/gi, // Bearer tokens
  /password["\s]*:["\s]*[^"]+/gi, // Password fields
  /api[_-]?key["\s]*:["\s]*[^"]+/gi, // API keys
  /authorization["\s]*:["\s]*[^"]+/gi, // Authorization headers
  /private[_-]?key["\s]*:["\s]*[^"]+/gi, // Private keys
  /secret["\s]*:["\s]*[^"]+/gi, // Secret fields
  /token["\s]*:["\s]*[^"]+/gi, // Token fields
]

// Function to sanitize sensitive data from logs
const sanitizeLogData = (data: any): any => {
  if (typeof data === "string") {
    let sanitized = data
    SENSITIVE_PATTERNS.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, (match) => {
        const colonIndex = match.indexOf(":")
        if (colonIndex !== -1) {
          return match.substring(0, colonIndex + 1) + ' "[REDACTED]"'
        }
        return match.substring(0, 6) + "[REDACTED]"
      })
    })
    return sanitized
  }

  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeLogData(item))
    }

    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase()
      if (
        keyLower.includes("password") ||
        keyLower.includes("token") ||
        keyLower.includes("secret") ||
        keyLower.includes("key") ||
        keyLower.includes("auth")
      ) {
        sanitized[key] = "[REDACTED]"
      } else {
        sanitized[key] = sanitizeLogData(value)
      }
    }
    return sanitized
  }

  return data
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] [${level.toUpperCase()}] ${stack || message}`
  })
)

// Define transports based on environment
const transports: winston.transport[] = []

if (isDevelopment || isDebug) {
  // Console transport for development
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    })
  )
}

if (isProduction) {
  // File transports for production
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: logFormat,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: logFormat,
    })
  )
}

// Fallback console transport if no other transports
if (transports.length === 0) {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
    })
  )
}

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  level: isProduction ? "warn" : isDebug ? "debug" : "info",
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
})

// Logger class to maintain existing interface
class Logger {
  private winston: winston.Logger

  constructor(winstonInstance: winston.Logger) {
    this.winston = winstonInstance
  }

  debug(message: string, ...args: any[]): void {
    this.winston.debug(message, ...args)
  }

  info(message: string, ...args: any[]): void {
    this.winston.info(message, ...args)
  }

  warn(message: string, ...args: any[]): void {
    this.winston.warn(message, ...args)
  }

  error(message: string, ...args: any[]): void {
    this.winston.error(message, ...args)
  }

  // Specialized logging methods for common use cases
  private logWithCategory(level: string, category: string, icon: string, message: string, ...args: any[]): void {
    const logMethod = this.winston[level as keyof winston.Logger] as any
    logMethod(`${icon} ${category}: ${message}`, ...args)
  }

  auth(message: string, ...args: any[]): void {
    this.logWithCategory("debug", "AUTH", "🔐", message, ...args)
  }

  database(message: string, ...args: any[]): void {
    this.logWithCategory("debug", "DB", "💾", message, ...args)
  }

  api(message: string, ...args: any[]): void {
    this.logWithCategory("debug", "API", "🌐", message, ...args)
  }

  security(message: string, ...args: any[]): void {
    this.logWithCategory("warn", "SECURITY", "🛡️", message, ...args)
  }

  startup(message: string, ...args: any[]): void {
    this.logWithCategory("info", "STARTUP", "🚀", message, ...args)
  }

  validation(message: string, ...args: any[]): void {
    this.logWithCategory("debug", "VALIDATION", "✅", message, ...args)
  }

  // Method to log errors with context (useful for debugging)
  errorWithContext(message: string, error: any, context?: any): void {
    const sanitizedContext = context ? sanitizeLogData(context) : undefined

    if (isProduction) {
      // In production, log minimal information without stack traces
      const sanitizedError = {
        message: error?.message || "Unknown error",
        code: error?.code,
        type: error?.constructor?.name || "Error",
      }
      this.winston.error(message, {
        error: sanitizedError,
        context: sanitizedContext,
        timestamp: new Date().toISOString(),
      })
    } else {
      // In development, log more details but still sanitize sensitive data
      const detailedError = {
        message: error?.message || error,
        stack: error?.stack,
        code: error?.code,
        type: error?.constructor?.name,
      }
      this.winston.error(message, {
        error: detailedError,
        context: sanitizedContext,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Enhanced security logging for audit trails
  audit(action: string, details: any, userId?: string): void {
    const sanitizedDetails = sanitizeLogData(details)
    this.logWithCategory("info", "AUDIT", "📋", action, {
      details: sanitizedDetails,
      userId: userId ? `user_${userId.substring(0, 8)}***` : "anonymous", // Partial user ID
      timestamp: new Date().toISOString(),
    })
  }

  // Security event logging
  securityEvent(event: string, details: any, severity: "low" | "medium" | "high" | "critical" = "medium"): void {
    const sanitizedDetails = sanitizeLogData(details)
    const logLevel = severity === "critical" ? "error" : severity === "high" ? "warn" : "info"
    this.logWithCategory(logLevel, "SECURITY", "🚨", event, {
      severity,
      details: sanitizedDetails,
      timestamp: new Date().toISOString(),
    })
  }

  // Safe user logging (only logs partial user info)
  userAction(action: string, userId: string, details?: any): void {
    const sanitizedDetails = details ? sanitizeLogData(details) : undefined
    this.logWithCategory("info", "USER", "👤", action, {
      userId: `user_${userId.substring(0, 8)}***`, // Partial user ID for privacy
      details: sanitizedDetails,
      timestamp: new Date().toISOString(),
    })
  }
}

// Export a singleton instance
export const logger = new Logger(winstonLogger)

// Export the class for testing or custom instances
export { Logger }
