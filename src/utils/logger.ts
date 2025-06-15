// Centralized logging utility for the backend
// Environment-aware logging with different levels based on NODE_ENV and DEBUG flags

import winston from "winston"

// Environment-aware Winston logger configuration
const isDevelopment = process.env.NODE_ENV === "development"
const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

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
    if (isProduction) {
      // In production, log minimal information
      this.winston.error(message, { context })
    } else {
      // In development, log full details
      this.winston.error(message, { error: error.message || error, stack: error.stack, context })
    }
  }
}

// Export a singleton instance
export const logger = new Logger(winstonLogger)

// Export the class for testing or custom instances
export { Logger }
