import { QueryDocumentSnapshot, Transaction } from "firebase-admin/firestore"
import { admin, db } from "../config/firebase"
import { CacheKeys, cacheService } from "../services/cacheService"
import {
  AuthenticatedRequest,
  ConflictError,
  DatabaseError,
  ExpressController,
  FIRESTORE_COLLECTIONS,
  ParameterNotFoundError,
  ValidationError,
} from "../types"
import { isCustomError } from "../types/errors"
import {
  buildConfigurationObject,
  checkParameterKeyExists,
  createParameterObject,
  detectConflictingFields,
  executeTransactionWithTimeout,
  fetchParameterDocument,
  getParametersCollectionRef,
  mergeOverrides,
  removeCountryOverride,
  setCountryOverride,
  validateCountryOverrideOperation,
} from "../utils/configHelpers"
import { logger } from "../utils/logger"
import { ParameterData, incrementVersion } from "../utils/parameterUtils"
import { resolveUserIdToEmail } from "../utils/userUtils"

// Mobile client configuration endpoint - gets parameters and resolves overrides with caching
export const getClientConfig: ExpressController = async (req, res) => {
  try {
    const { country } = req.query // Get country from query parameters
    const cacheKey = CacheKeys.CLIENT_CONFIG(country as string)

    logger.database("Fetching client configuration")

    // Try to get from cache first
    const config = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.database("Cache miss - fetching from database")
        const query = getParametersCollectionRef({ activeOnly: true })
        const parametersSnapshot = await query.get()
        return buildConfigurationObject(parametersSnapshot.docs, country as string)
      },
      5 * 60 // 5 minutes TTL
    )

    logger.api(
      `Client configuration retrieved with ${Object.keys(config).length} parameters${
        country ? ` for country: ${country}` : ""
      }`
    )
    res.status(200).json(config)
  } catch (error) {
    if (isCustomError(error)) {
      throw error
    }
    logger.errorWithContext("Error fetching client configuration", error)
    res.status(500).json({ error: "Internal server error", message: "Error fetching configuration." })
  }
}

// Helper functions moved to utils/configHelpers.ts

export const getParameters: ExpressController = async (req, res) => {
  try {
    logger.database("Fetching parameters collection")

    const parametersSnapshot = await db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).orderBy("createdAt", "desc").get()

    const parameters = parametersSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))

    logger.api(`Retrieved ${parameters.length} parameters`)
    res.status(200).json(parameters)
  } catch (error) {
    logger.errorWithContext("Error fetching parameters", error)
    res.status(500).json({ error: "Internal server error", message: "Error fetching parameters." })
  }
}

export const getParameter: ExpressController = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      throw new ValidationError("Parameter ID is required", "id")
    }

    logger.database(`Fetching parameter ${id}`)

    const { doc, data } = await fetchParameterDocument(id)

    const parameter = {
      id: doc.id,
      ...data,
    }

    logger.api(`Parameter retrieved: ${parameter.key} (version: ${parameter.version})`)
    logger.debug(`Parameter data for ${id}:`, JSON.stringify(parameter, null, 2))

    res.json({ parameter })
  } catch (error: unknown) {
    logger.errorWithContext("Error fetching parameter", error, { id: req.params.id || "unknown" })

    if (error instanceof ParameterNotFoundError || error instanceof ValidationError) {
      res.status(error.statusCode).json({
        error: error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    res.status(500).json({
      error: "Internal server error while fetching parameter",
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
}

export const addParameter: ExpressController = async (req, res) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user!
    const { key } = req.body

    logger.database("Adding new parameter")

    // Check if parameter key already exists
    const keyCheck = await checkParameterKeyExists(key)
    if (keyCheck.exists) {
      logger.userAction("Duplicate Parameter Key Attempt", uid, {
        attemptedKey: key,
        existingParameterId: keyCheck.existingParameter?.id,
      })

      res.status(409).json({
        error: "Conflict",
        message: `Parameter with key '${key}' already exists`,
        details: {
          existingParameterId: keyCheck.existingParameter?.id,
          conflictingKey: key,
        },
      })
      return
    }

    const newParameter = createParameterObject(req.body, uid)
    const docRef = await db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).add(newParameter)

    logger.audit(
      "Parameter Created",
      {
        parameterId: docRef.id,
        parameterKey: req.body.key,
        version: 0,
      },
      uid
    )

    res.status(201).json({ id: docRef.id, ...newParameter })
  } catch (error) {
    logger.errorWithContext("Error adding parameter", error, {
      operation: "create_parameter",
      userId: (req as AuthenticatedRequest).user?.uid,
    })
    res.status(500).json({ error: "Internal server error", message: "Error adding parameter." })
  }
}

export const updateParameter: ExpressController = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: "Bad request", message: "Parameter ID is required" })
      return
    }

    const { uid } = (req as AuthenticatedRequest).user!
    const { lastKnownVersion, forceUpdate = false, ...updateData } = req.body

    logger.database(`Updating parameter ${id} with version check`)

    // Check if the new key already exists (excluding current parameter)
    if (updateData.key) {
      const keyCheck = await checkParameterKeyExists(updateData.key, id)
      if (keyCheck.exists) {
        logger.userAction("Duplicate Parameter Key Update Attempt", uid, {
          parameterId: id,
          attemptedKey: updateData.key,
          existingParameterId: keyCheck.existingParameter?.id,
        })

        res.status(409).json({
          error: "Conflict",
          message: `Parameter with key '${updateData.key}' already exists`,
          details: {
            existingParameterId: keyCheck.existingParameter?.id,
            conflictingKey: updateData.key,
          },
        })
        return
      }
    }

    const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

    await db.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(parameterRef)

      if (!doc.exists) {
        throw new Error("Parameter not found.")
      }

      const existingData = doc.data()!
      const currentVersion = existingData.version || 0

      // Version-based conflict detection (Strategy 1: Check only on save)
      if (lastKnownVersion !== undefined && lastKnownVersion !== currentVersion && !forceUpdate) {
        // Resolve the user ID to email for better conflict details
        const lastModifiedByEmail = await resolveUserIdToEmail(existingData.lastUpdatedBy || "")

        logger.securityEvent(
          "Version Conflict Detected",
          {
            parameterId: id,
            providedVersion: lastKnownVersion,
            currentVersion: currentVersion,
            lastModifiedBy: lastModifiedByEmail,
            lastModifiedById: existingData.lastUpdatedBy,
            userId: uid,
          },
          "medium"
        )

        throw new ConflictError("Configuration has been modified by another user", {
          currentVersion,
          providedVersion: lastKnownVersion,
          lastModifiedBy: lastModifiedByEmail,
          lastModifiedAt: existingData.updatedAt,
          conflictingFields: detectConflictingFields(updateData, existingData as ParameterData),
        })
      }

      logger.database(`Version check passed: ${lastKnownVersion} -> ${currentVersion + 1}`)

      // Intelligently merge overrides instead of replacing them
      const mergedOverrides =
        updateData.overrides !== undefined
          ? mergeOverrides(existingData.overrides || {}, updateData.overrides, "merge")
          : existingData.overrides || {}

      const mergedRequestBody = {
        ...updateData,
        overrides: mergedOverrides,
      }

      // Update the parameter with new timestamp and incremented version
      const updatedParameter = createParameterObject(mergedRequestBody, uid, true, currentVersion)
      transaction.update(parameterRef, updatedParameter)
    })

    logger.audit(
      "Parameter Updated",
      {
        parameterId: id,
        parameterKey: updateData.key,
        versionIncrement: `${lastKnownVersion || "unknown"} -> ${(lastKnownVersion || 0) + 1}`,
        forceUpdate: forceUpdate,
      },
      uid
    )

    res.status(200).json({
      message: "Parameter updated successfully.",
      newVersion: (lastKnownVersion || 0) + 1,
    })
  } catch (error) {
    // Handle conflict errors specifically
    if (error instanceof ConflictError) {
      logger.userAction("Update Conflict", (req as AuthenticatedRequest).user?.uid || "unknown", {
        parameterId: req.params.id,
        conflictDetails: error.details,
      })

      res.status(409).json({
        error: "Conflict",
        message: error.message,
        conflictDetails: error.details,
        resolutionOptions: {
          forceUpdate: "Override changes and update anyway (set forceUpdate: true)",
          fetchLatest: "Get latest version and retry with correct lastKnownVersion",
          cancel: "Cancel the update operation",
        },
      })
      return
    }

    logger.errorWithContext("Error updating parameter", error, { id: req.params.id || "unknown" })
    if (error instanceof Error) {
      if (error.message === "Parameter not found.") {
        res.status(404).json({ error: "Not found", message: error.message })
        return
      }
    }
    res.status(500).json({ error: "Internal server error", message: "Error updating parameter." })
  }
}

export const deleteParameter: ExpressController = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      throw new ValidationError("Parameter ID is required", "id")
    }

    logger.database("Deleting parameter")

    const user = (req as AuthenticatedRequest).user
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const { doc, data } = await fetchParameterDocument(id)

    logger.database("Processing parameter deletion")

    await executeTransactionWithTimeout(async (transaction) => {
      transaction.delete(doc.ref)
    })

    logger.audit("Parameter Deleted", { key: data.key, id, deletedBy: user.email || user.uid }, user.uid)

    res.json({ message: "Parameter deleted successfully" })
  } catch (error: unknown) {
    logger.errorWithContext("Error deleting parameter", error, { id: req.params.id || "unknown" })

    if (error instanceof ParameterNotFoundError || error instanceof ValidationError || error instanceof DatabaseError) {
      res.status(error.statusCode).json({
        error: error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    res.status(500).json({
      error: "Internal server error while deleting parameter",
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
}

export const setCountryOverrideController: ExpressController = async (req, res) => {
  try {
    const { id, countryCode } = req.params
    const { value, lastKnownVersion, forceUpdate = false } = req.body
    const { uid } = (req as AuthenticatedRequest).user!

    if (!id || !countryCode) {
      res.status(400).json({
        error: "Bad request",
        message: "Parameter ID and country code are required",
      })
      return
    }

    // Validate country override operation
    validateCountryOverrideOperation(countryCode, value, "set")

    logger.database(`Setting country override for parameter ${id}, country ${countryCode}`)
    const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

    await db.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(parameterRef)

      if (!doc.exists) {
        throw new Error("Parameter not found.")
      }

      const existingData = doc.data()!
      const currentVersion = existingData.version || 0

      // Version-based conflict detection
      if (lastKnownVersion !== undefined && lastKnownVersion !== currentVersion && !forceUpdate) {
        const lastModifiedByEmail = await resolveUserIdToEmail(existingData.lastUpdatedBy || "")

        throw new ConflictError("Configuration has been modified by another user", {
          currentVersion,
          providedVersion: lastKnownVersion,
          lastModifiedBy: lastModifiedByEmail,
          lastModifiedAt: existingData.updatedAt,
          conflictingFields: [`overrides.country.${countryCode.toUpperCase()}`],
        })
      }

      // Set the specific country override
      const updatedOverrides = setCountryOverride(existingData.overrides || {}, countryCode, value)

      const updatedParameter = {
        ...existingData,
        overrides: updatedOverrides,
        version: incrementVersion(currentVersion),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
      }

      transaction.update(parameterRef, updatedParameter)
    })

    logger.audit(
      "Country Override Set",
      {
        parameterId: id,
        countryCode: countryCode.toUpperCase(),
        value,
        versionIncrement: `${lastKnownVersion || "unknown"} -> ${(lastKnownVersion || 0) + 1}`,
        forceUpdate,
      },
      uid
    )

    res.status(200).json({
      message: `Country override for ${countryCode.toUpperCase()} set successfully.`,
      newVersion: (lastKnownVersion || 0) + 1,
    })
  } catch (error) {
    // Handle conflict errors specifically
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: "Conflict",
        message: error.message,
        conflictDetails: error.details,
        resolutionOptions: {
          forceUpdate: "Override changes and update anyway (set forceUpdate: true)",
          fetchLatest: "Get latest version and retry with correct lastKnownVersion",
          cancel: "Cancel the update operation",
        },
      })
      return
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: "Validation error",
        message: error.message,
        field: error.field,
      })
      return
    }

    logger.errorWithContext("Error setting country override", error, {
      id: req.params.id || "unknown",
      countryCode: req.params.countryCode || "unknown",
    })

    if (error instanceof Error && error.message === "Parameter not found.") {
      res.status(404).json({ error: "Not found", message: error.message })
      return
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Error setting country override.",
    })
  }
}

export const deleteCountryOverrideController: ExpressController = async (req, res) => {
  try {
    const { id, countryCode } = req.params
    const { lastKnownVersion, forceUpdate = false } = req.body
    const { uid } = (req as AuthenticatedRequest).user!

    if (!id || !countryCode) {
      res.status(400).json({
        error: "Bad request",
        message: "Parameter ID and country code are required",
      })
      return
    }

    // Validate country override operation
    validateCountryOverrideOperation(countryCode, undefined, "delete")

    logger.database(`Deleting country override for parameter ${id}, country ${countryCode}`)
    const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

    let finalVersion = 0

    await db.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(parameterRef)

      if (!doc.exists) {
        throw new Error("Parameter not found.")
      }

      const existingData = doc.data()!
      const currentVersion = existingData.version || 0
      finalVersion = incrementVersion(currentVersion)

      // Check if country override exists
      if (!existingData.overrides?.country?.[countryCode.toUpperCase()]) {
        throw new ValidationError(`Country override for ${countryCode.toUpperCase()} does not exist`, "countryCode")
      }

      // Version-based conflict detection
      if (lastKnownVersion !== undefined && lastKnownVersion !== currentVersion && !forceUpdate) {
        const lastModifiedByEmail = await resolveUserIdToEmail(existingData.lastUpdatedBy || "")

        throw new ConflictError("Configuration has been modified by another user", {
          currentVersion,
          providedVersion: lastKnownVersion,
          lastModifiedBy: lastModifiedByEmail,
          lastModifiedAt: existingData.updatedAt,
          conflictingFields: [`overrides.country.${countryCode.toUpperCase()}`],
        })
      }

      // Remove the specific country override
      const updatedOverrides = removeCountryOverride(existingData.overrides || {}, countryCode)

      const updatedParameter = {
        ...existingData,
        overrides: updatedOverrides,
        version: finalVersion,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
      }

      transaction.update(parameterRef, updatedParameter)
    })

    logger.audit(
      "Country Override Deleted",
      {
        parameterId: id,
        countryCode: countryCode.toUpperCase(),
        versionIncrement: `${lastKnownVersion || "unknown"} -> ${(lastKnownVersion || 0) + 1}`,
        forceUpdate,
      },
      uid
    )

    res.status(200).json({
      message: `Country override for ${countryCode.toUpperCase()} deleted successfully.`,
      newVersion: finalVersion,
    })
  } catch (error) {
    // Handle conflict errors specifically
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: "Conflict",
        message: error.message,
        conflictDetails: error.details,
        resolutionOptions: {
          forceUpdate: "Override changes and update anyway (set forceUpdate: true)",
          fetchLatest: "Get latest version and retry with correct lastKnownVersion",
          cancel: "Cancel the update operation",
        },
      })
      return
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: "Validation error",
        message: error.message,
        field: error.field,
      })
      return
    }

    logger.errorWithContext("Error deleting country override", error, {
      id: req.params.id || "unknown",
      countryCode: req.params.countryCode || "unknown",
    })

    if (error instanceof Error && error.message === "Parameter not found.") {
      res.status(404).json({ error: "Not found", message: error.message })
      return
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Error deleting country override.",
    })
  }
}

export const getCountryOverridesController: ExpressController = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(400).json({
        error: "Bad request",
        message: "Parameter ID is required",
      })
      return
    }

    logger.database(`Getting country overrides for parameter ${id}`)

    const { doc, data } = await fetchParameterDocument(id)

    const countryOverrides = data.overrides?.country || {}

    logger.api(`Retrieved ${Object.keys(countryOverrides).length} country overrides for parameter ${id}`)

    res.status(200).json({
      parameterId: id,
      parameterKey: data.key,
      countryOverrides,
      availableCountries: Object.keys(countryOverrides),
      totalOverrides: Object.keys(countryOverrides).length,
    })
  } catch (error: unknown) {
    logger.errorWithContext("Error fetching country overrides", error, {
      id: req.params.id || "unknown",
    })

    if (error instanceof ParameterNotFoundError || error instanceof ValidationError) {
      res.status(error.statusCode).json({
        error: error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    res.status(500).json({
      error: "Internal server error while fetching country overrides",
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
}
