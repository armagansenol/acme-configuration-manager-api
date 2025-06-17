import { Router } from "express"
import {
  getClientConfig,
  getParameters,
  getParameter,
  addParameter,
  updateParameter,
  deleteParameter,
  setCountryOverrideController,
  deleteCountryOverrideController,
  getCountryOverridesController,
} from "../controllers/configController"
import {
  verifyFirebaseToken,
  verifyApiKey,
  validateBody,
  validateParams,
  validateQuery,
  parameterSchema,
  updateParameterSchema,
  deleteParameterSchema,
  countryOverrideSchema,
  deleteCountryOverrideSchema,
  idParamSchema,
  countryParamSchema,
  querySchema,
  generalApiLimiter,
  adminApiLimiter,
  clientConfigLimiter,
  sensitiveOperationLimiter,
  defaultRequestLogger,
  performanceLoggingMiddleware,
} from "../middleware"

const router = Router()

// Apply logging and performance monitoring middleware
router.use(defaultRequestLogger)
router.use(performanceLoggingMiddleware(2000)) // Log requests slower than 2 seconds

// Get all configuration parameters - Admin only
router.get("/parameters", adminApiLimiter, verifyFirebaseToken, validateQuery(querySchema), getParameters)

// Get a single configuration parameter by ID - Admin only
router.get("/parameters/:id", adminApiLimiter, verifyFirebaseToken, validateParams(idParamSchema), getParameter)

// Create a new configuration parameter - Admin only
router.post("/parameters", adminApiLimiter, verifyFirebaseToken, validateBody(parameterSchema), addParameter)

// Update an existing configuration parameter - Admin only
router.put(
  "/parameters/:id",
  adminApiLimiter,
  verifyFirebaseToken,
  validateParams(idParamSchema),
  validateBody(updateParameterSchema),
  updateParameter
)

// Delete a configuration parameter - Admin only
router.delete(
  "/parameters/:id",
  sensitiveOperationLimiter,
  verifyFirebaseToken,
  validateParams(idParamSchema),
  validateBody(deleteParameterSchema),
  deleteParameter
)

// Get country overrides for a parameter - Admin only
router.get(
  "/parameters/:id/overrides/country",
  adminApiLimiter,
  verifyFirebaseToken,
  validateParams(idParamSchema),
  getCountryOverridesController
)

// Set a country override for a parameter - Admin only
router.put(
  "/parameters/:id/overrides/country/:countryCode",
  adminApiLimiter,
  verifyFirebaseToken,
  validateParams(countryParamSchema),
  validateBody(countryOverrideSchema),
  setCountryOverrideController
)

// Delete a country override for a parameter - Admin only
router.delete(
  "/parameters/:id/overrides/country/:countryCode",
  adminApiLimiter, // Changed from sensitiveOperationLimiter for better dev experience
  verifyFirebaseToken,
  validateParams(countryParamSchema),
  validateBody(deleteCountryOverrideSchema),
  deleteCountryOverrideController
)

// Get client configuration with resolved parameter values - Mobile API
router.get("/client-config", clientConfigLimiter, verifyApiKey, validateQuery(querySchema), getClientConfig)

export default router
