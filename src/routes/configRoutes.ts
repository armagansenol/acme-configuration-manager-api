import express from "express"
import { getClientConfig } from "../controllers/clientConfigController"
import {
  addParameter,
  deleteCountryOverrideController,
  deleteParameter,
  getCountryOverridesController,
  getParameter,
  getParameters,
  setCountryOverrideController,
  updateParameter,
} from "../controllers/configController"
import {
  clientConfigLimiter,
  defaultRequestLogger,
  performanceLoggingMiddleware,
  validateBody,
  validateQuery,
  verifyApiKey,
} from "../middleware"
import { verifyFirebaseToken } from "../middleware/auth"
import {
  countryOverrideSchema,
  deleteCountryOverrideSchema,
  parameterSchema,
  querySchema,
  updateParameterSchema,
} from "../middleware/validation"

const router = express.Router()

// Public route for health check
router.get("/health", (req, res) => {
  res.status(200).send("OK")
})

/**
 * @swagger
 * /api/client-config:
 *   get:
 *     summary: Get client configuration
 *     description: Retrieve configuration parameters for mobile/client applications. This endpoint provides a simplified configuration object optimized for client consumption with country-specific overrides applied.
 *     tags: [Client Configuration]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: country
 *         required: false
 *         schema:
 *           type: string
 *         description: Country code to apply country-specific overrides (e.g., 'US', 'GB')
 *         example: US
 *     responses:
 *       200:
 *         description: Client configuration object with resolved country overrides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *               example:
 *                 feature_enabled: true
 *                 max_retry_count: 3
 *                 timeout_ms: 5000
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Invalid or missing API key
 *       500:
 *         description: Internal server error
 */
router.get("/client-config", verifyApiKey, validateQuery(querySchema), getClientConfig)

// All other routes below this require Firebase authentication
router.use(verifyFirebaseToken)

/**
 * @swagger
 * /api/parameters:
 *   get:
 *     summary: Get all parameters
 *     description: Retrieve a list of all configuration parameters. Requires authentication.
 *     tags: [Parameters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Parameter'
 */
router.get("/parameters", getParameters)

/**
 * @swagger
 * /api/parameters/{id}:
 *   get:
 *     summary: Get a single parameter
 *     description: Retrieve a single configuration parameter by its ID. Requires authentication.
 *     tags: [Parameters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The requested parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Parameter'
 *       404:
 *         description: Parameter not found
 */
router.get("/parameters/:id", getParameter)

/**
 * @swagger
 * /api/parameters:
 *   post:
 *     summary: Create a new parameter
 *     description: Add a new configuration parameter. Requires authentication.
 *     tags: [Parameters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewParameter'
 *     responses:
 *       201:
 *         description: The created parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Parameter'
 *       409:
 *         description: Parameter with the same key already exists
 */
router.post("/parameters", validateBody(parameterSchema), addParameter)

/**
 * @swagger
 * /api/parameters/{id}:
 *   put:
 *     summary: Update a parameter
 *     description: Update an existing configuration parameter. Implements optimistic locking via versioning. Requires authentication.
 *     tags: [Parameters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateParameter'
 *     responses:
 *       200:
 *         description: Parameter updated successfully
 *       404:
 *         description: Parameter not found
 *       409:
 *         description: Version conflict
 */
router.put("/parameters/:id", validateBody(updateParameterSchema), updateParameter)

/**
 * @swagger
 * /api/parameters/{id}:
 *   delete:
 *     summary: Delete a parameter
 *     description: Delete a configuration parameter by its ID. Requires authentication.
 *     tags: [Parameters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Parameter deleted successfully
 *       404:
 *         description: Parameter not found
 */
router.delete("/parameters/:id", deleteParameter)

/**
 * @swagger
 * /api/parameters/{id}/overrides/country:
 *   get:
 *     summary: Get all country overrides for a parameter
 *     description: Retrieve all country-specific overrides for a given parameter. Requires authentication.
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of country overrides
 */
router.get("/parameters/:id/overrides/country", getCountryOverridesController)

/**
 * @swagger
 * /api/parameters/{id}/overrides/country/{countryCode}:
 *   put:
 *     summary: Set a country override
 *     description: Set or update a country-specific override for a parameter. Requires authentication.
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: countryCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CountryOverride'
 *     responses:
 *       200:
 *         description: Country override set successfully
 */
router.put(
  "/parameters/:id/overrides/country/:countryCode",
  validateBody(countryOverrideSchema),
  setCountryOverrideController
)

/**
 * @swagger
 * /api/parameters/{id}/overrides/country/{countryCode}:
 *   delete:
 *     summary: Delete a country override
 *     description: Delete a country-specific override for a parameter. Requires authentication.
 *     tags: [Overrides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: countryCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Country override deleted successfully
 */
router.delete(
  "/parameters/:id/overrides/country/:countryCode",
  validateBody(deleteCountryOverrideSchema),
  deleteCountryOverrideController
)

export default router
