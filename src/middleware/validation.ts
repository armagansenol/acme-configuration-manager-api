import { Request, Response, NextFunction } from "express"
import Joi from "joi"
import { logger } from "../utils/logger"
import { ValidationError } from "../types/errors"

/**
 * Security patterns that could indicate injection attempts
 */
const SUSPICIOUS_PATTERNS = [
  // SQL injection patterns
  /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b)/gi,
  // NoSQL injection patterns
  /(\$where|\$regex|\$gt|\$lt|\$ne|\$in|\$nin)/gi,
  // Script injection patterns
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // JavaScript function calls
  /\b(eval|setTimeout|setInterval|Function|document\.|window\.)/gi,
  // Command injection patterns
  /[;&|`$()]/g,
  // Path traversal
  /\.\.\//g,
]

/**
 * Custom Joi validator for security checks
 */
const secureString = Joi.string().custom((value, helpers) => {
  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(value)) {
      logger.securityEvent(
        "Suspicious pattern detected in input validation",
        {
          value: value.substring(0, 100), // Log first 100 chars for debugging
          pattern: pattern.source,
          field: helpers.state.path?.join(".") || "unknown",
        },
        "high"
      )
      throw new ValidationError(
        `Input contains potentially malicious content`,
        helpers.state.path?.join(".") || "value"
      )
    }
  }

  // Remove null bytes and control characters
  const sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  return sanitized
}, "Security validation")

/**
 * Custom Joi validator for parameter keys with security checks
 */
const secureParameterKey = Joi.string()
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .max(100)
  .custom((value, helpers) => {
    // Prevent keys that could be problematic
    const reservedKeys = ["__proto__", "constructor", "prototype", "toString", "valueOf"]
    if (reservedKeys.includes(value)) {
      throw new ValidationError(`Reserved parameter key: ${value}`, "key")
    }
    return value
  }, "Parameter key security validation")

/**
 * Deep validation for parameter values
 */
const secureParameterValue = Joi.alternatives().try(
  secureString.max(10000), // Strings with security checks
  Joi.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER), // Safe numbers
  Joi.boolean()
)

/**
 * Deep validation for nested overrides
 */
const secureOverrides = Joi.object({
  country: Joi.object()
    .pattern(/^[A-Z]{2}$/, secureParameterValue)
    .optional()
    .custom((value, helpers) => {
      // Additional validation for country overrides
      if (value && Object.keys(value).length > 50) {
        throw new ValidationError("Too many country overrides (max 50)", "overrides.country")
      }
      return value
    }, "Country overrides validation"),
}).optional()

// Enhanced Joi validation schemas with deep security validation
export const parameterSchema = Joi.object({
  key: secureParameterKey.required().messages({
    "string.pattern.base": "Parameter key can only contain alphanumeric characters, underscores, and hyphens",
    "string.max": "Parameter key cannot exceed 100 characters",
    "any.required": "Parameter key is required",
  }),
  value: secureParameterValue.required().messages({
    "any.required": "Parameter value is required",
  }),
  description: secureString.max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isActive: Joi.boolean().optional().default(true),
  overrides: secureOverrides,
})

export const updateParameterSchema = Joi.object({
  lastKnownVersion: Joi.number().integer().min(0).optional().messages({
    "number.base": "Last known version must be a number",
    "number.integer": "Last known version must be an integer",
    "number.min": "Last known version cannot be negative",
  }),
  forceUpdate: Joi.boolean().optional().default(false).messages({
    "boolean.base": "Force update must be a boolean value",
  }),
  key: secureParameterKey.required().messages({
    "string.pattern.base": "Parameter key can only contain alphanumeric characters, underscores, and hyphens",
    "string.max": "Parameter key cannot exceed 100 characters",
    "any.required": "Parameter key is required",
  }),
  value: secureParameterValue.required().messages({
    "any.required": "Parameter value is required",
  }),
  description: secureString.max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isActive: Joi.boolean().optional(),
  overrides: secureOverrides,
})

export const deleteParameterSchema = Joi.object({})

export const countryOverrideSchema = Joi.object({
  value: secureParameterValue.required().messages({
    "any.required": "Override value is required",
  }),
  lastKnownVersion: Joi.number().integer().min(0).optional().messages({
    "number.base": "Last known version must be a number",
    "number.integer": "Last known version must be an integer",
    "number.min": "Last known version cannot be negative",
  }),
  forceUpdate: Joi.boolean().optional().default(false).messages({
    "boolean.base": "Force update must be a boolean value",
  }),
})

export const deleteCountryOverrideSchema = Joi.object({
  lastKnownVersion: Joi.number().integer().min(0).optional().messages({
    "number.base": "Last known version must be a number",
    "number.integer": "Last known version must be an integer",
    "number.min": "Last known version cannot be negative",
  }),
  forceUpdate: Joi.boolean().optional().default(false).messages({
    "boolean.base": "Force update must be a boolean value",
  }),
})

export const idParamSchema = Joi.object({
  id: Joi.string().required().messages({
    "any.required": "Parameter ID is required",
  }),
})

export const countryParamSchema = Joi.object({
  id: Joi.string().required().messages({
    "any.required": "Parameter ID is required",
  }),
  countryCode: Joi.string()
    .pattern(/^[A-Z]{2}$/)
    .required()
    .messages({
      "string.pattern.base": "Country code must be 2 uppercase letters",
      "any.required": "Country code is required",
    }),
})

export const querySchema = Joi.object({
  country: Joi.string()
    .pattern(/^[A-Z]{2}$/)
    .optional()
    .messages({
      "string.pattern.base": "Country code must be 2 uppercase letters",
    }),
})

// Validation middleware functions
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false, // Return all validation errors
        stripUnknown: true, // Remove unknown fields
        allowUnknown: false, // Don't allow unknown fields
      })

      if (error) {
        logger.validation(`Body validation failed: ${error.details.map((d) => d.message).join(", ")}`)

        // Check if any error is a security violation
        const hasSecurityViolation = error.details.some(
          (detail) =>
            detail.message.includes("malicious") ||
            detail.message.includes("Reserved") ||
            detail.message.includes("Dangerous")
        )

        if (hasSecurityViolation) {
          logger.securityEvent(
            "Security validation failed",
            {
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              path: req.path,
              errors: error.details.map((d) => d.message),
            },
            "medium"
          )
        }

        res.status(400).json({
          error: "Validation error",
          message: "Request body validation failed",
          details: error.details.map((detail) => ({
            field: detail.path.join("."),
            message: detail.message,
          })),
        })
        return
      }

      // Replace req.body with sanitized values
      req.body = value
      logger.validation("Body validation passed")
      next()
    } catch (customError) {
      if (customError instanceof ValidationError) {
        logger.securityEvent(
          "Custom validation error",
          {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            path: req.path,
            field: customError.field,
            message: customError.message,
          },
          "high"
        )

        res.status(400).json({
          error: "Security validation failed",
          message: customError.message,
          field: customError.field,
        })
        return
      }

      logger.errorWithContext("Validation middleware error", customError)
      res.status(500).json({
        error: "Internal server error",
        message: "Validation processing failed",
      })
    }
  }
}

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params)

    if (error) {
      logger.validation(`Params validation failed: ${error.details.map((d) => d.message).join(", ")}`)
      res.status(400).json({
        error: "Validation error",
        message: "Request parameters validation failed",
        details: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      })
      return
    }

    logger.validation("Params validation passed")
    next()
  }
}

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query)

    if (error) {
      logger.validation(`Query validation failed: ${error.details.map((d) => d.message).join(", ")}`)
      res.status(400).json({
        error: "Validation error",
        message: "Query parameters validation failed",
        details: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      })
      return
    }

    logger.validation("Query validation passed")
    next()
  }
}
