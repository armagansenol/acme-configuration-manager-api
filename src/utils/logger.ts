import winston from "winston"

// Configure log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const logColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
}

winston.addColors(logColors)

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `${timestamp} [${level}]: ${message}\n${stack}`
    }
    return `${timestamp} [${level}]: ${message}`
  })
)

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: logFormat,
  }),
]

// Add file transport in production
if (process.env.NODE_ENV === "production" && process.env.LOG_FILE_PATH) {
  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    })
  )
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels: logLevels,
  transports,
  exitOnError: false,
})

// Custom logging methods
const customLogger = {
  ...logger,

  startup: (message: string) => {
    logger.info(`🚀 STARTUP: ${message}`)
  },

  errorWithContext: (message: string, error: unknown) => {
    if (error instanceof Error) {
      logger.error(`${message}: ${error.message}`, { stack: error.stack })
    } else {
      logger.error(`${message}: ${String(error)}`)
    }
  },

  security: (message: string, details?: Record<string, unknown>) => {
    logger.warn(`🔐 SECURITY: ${message}`, details)
  },

  database: (message: string, details?: Record<string, unknown>) => {
    logger.info(`💾 DATABASE: ${message}`, details)
  },

  api: (message: string, details?: Record<string, unknown>) => {
    logger.http(`🌐 API: ${message}`, details)
  },
}

export { customLogger as logger }
