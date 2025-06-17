/**
 * Custom error classes for the configuration manager API
 */

/**
 * Conflict Error for version-based optimistic locking
 */
export interface ConflictErrorDetails {
  currentVersion: number
  providedVersion: number
  lastModifiedBy?: string // Email address of the user who last modified the resource
  lastModifiedAt?: any
  conflictingFields?: string[]
}

export class ConflictError extends Error {
  public override readonly name = "ConflictError"
  public readonly statusCode = 409
  public readonly details: ConflictErrorDetails

  constructor(message: string, details: ConflictErrorDetails) {
    super(message)
    this.details = details
  }
}

export class ParameterNotFoundError extends Error {
  public override readonly name = "ParameterNotFoundError"
  public readonly statusCode = 404

  constructor(id: string) {
    super(`Parameter with ID ${id} not found`)
  }
}

export class ValidationError extends Error {
  public override readonly name = "ValidationError"
  public readonly statusCode = 400
  public readonly field: string

  constructor(message: string, field: string) {
    super(message)
    this.field = field
  }
}

export class DatabaseError extends Error {
  public override readonly name = "DatabaseError"
  public readonly statusCode = 500
  public readonly operation: string

  constructor(message: string, operation: string) {
    super(message)
    this.operation = operation
  }
}

export class AuthenticationError extends Error {
  public override readonly name = "AuthenticationError"
  public readonly statusCode = 401

  constructor(message: string = "Authentication failed") {
    super(message)
  }
}

export class AuthorizationError extends Error {
  public override readonly name = "AuthorizationError"
  public readonly statusCode = 403

  constructor(message: string = "Insufficient permissions") {
    super(message)
  }
}

export class RateLimitError extends Error {
  public override readonly name = "RateLimitError"
  public readonly statusCode = 429

  constructor(message: string = "Too many requests") {
    super(message)
  }
}

export class CacheError extends Error {
  public override readonly name = "CacheError"
  public readonly statusCode = 500

  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message)
  }
}

export class TransactionTimeoutError extends Error {
  public override readonly name = "TransactionTimeoutError"
  public readonly statusCode = 503

  constructor(message: string = "Transaction timeout") {
    super(message)
  }
}

export class ConfigurationError extends Error {
  public override readonly name = "ConfigurationError"
  public readonly statusCode = 500

  constructor(message: string) {
    super(message)
  }
}

/**
 * Type guard to check if an error is one of our custom errors
 */
export function isCustomError(error: any): error is { name: string; statusCode: number; message: string } {
  return error && typeof error.statusCode === "number" && typeof error.name === "string"
}

/**
 * Extract error details for logging
 */
export function getErrorDetails(error: unknown): { name: string; message: string; stack?: string | undefined } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack && { stack: error.stack }),
    }
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "An unknown error occurred",
  }
}
