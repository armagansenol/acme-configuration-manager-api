import { Request, Response, NextFunction } from "express"
import Joi from "joi"
import { logger } from "../utils/logger"

// Joi validation schemas
export const parameterSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .max(100)
    .required()
    .messages({
      "string.pattern.base": "Parameter key can only contain alphanumeric characters, underscores, and hyphens",
      "string.max": "Parameter key cannot exceed 100 characters",
      "any.required": "Parameter key is required",
    }),
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
    .required()
    .messages({
      "any.required": "Parameter value is required",
    }),
  description: Joi.string().max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isActive: Joi.boolean().optional().default(true),
  overrides: Joi.object({
    country: Joi.object()
      .pattern(
        /^[A-Z]{2}$/,
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
      )
      .optional(),
  }).optional(),
})

export const updateParameterSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .max(100)
    .required()
    .messages({
      "string.pattern.base": "Parameter key can only contain alphanumeric characters, underscores, and hyphens",
      "string.max": "Parameter key cannot exceed 100 characters",
      "any.required": "Parameter key is required",
    }),
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
    .required()
    .messages({
      "any.required": "Parameter value is required",
    }),
  description: Joi.string().max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isActive: Joi.boolean().optional(),
  overrides: Joi.object({
    country: Joi.object()
      .pattern(
        /^[A-Z]{2}$/,
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array())
      )
      .optional(),
  }).optional(),
})

export const deleteParameterSchema = Joi.object({})

export const idParamSchema = Joi.object({
  id: Joi.string().required().messages({
    "any.required": "Parameter ID is required",
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
    const { error } = schema.validate(req.body)

    if (error) {
      logger.validation(`Body validation failed: ${error.details.map((d) => d.message).join(", ")}`)
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

    logger.validation("Body validation passed")
    next()
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
