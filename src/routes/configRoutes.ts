import { Router } from "express"
import {
  getClientConfig,
  getParameters,
  addParameter,
  updateParameter,
  deleteParameter,
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
  idParamSchema,
  querySchema,
} from "../middleware"

const router = Router()

// Get all configuration parameters - Admin only
router.get("/parameters", verifyFirebaseToken, validateQuery(querySchema), getParameters)

// Create a new configuration parameter - Admin only
router.post("/parameters", verifyFirebaseToken, validateBody(parameterSchema), addParameter)

// Update an existing configuration parameter - Admin only
router.put(
  "/parameters/:id",
  verifyFirebaseToken,
  validateParams(idParamSchema),
  validateBody(updateParameterSchema),
  updateParameter
)

// Delete a configuration parameter - Admin only
router.delete(
  "/parameters/:id",
  verifyFirebaseToken,
  validateParams(idParamSchema),
  validateBody(deleteParameterSchema),
  deleteParameter
)

// Get client configuration with resolved parameter values - Mobile API
router.get("/client-config", verifyApiKey, validateQuery(querySchema), getClientConfig)

export default router
