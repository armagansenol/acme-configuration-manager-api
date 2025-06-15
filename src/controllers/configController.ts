import { QueryDocumentSnapshot, Transaction } from "firebase-admin/firestore"
import { admin, db } from "../config/firebase"
import { AuthenticatedRequest, ExpressController, FIRESTORE_COLLECTIONS } from "../types"
import { logger } from "../utils/logger"
import { resolveParameterValue, prepareParameterForStorage, ParameterData } from "../utils/parameterUtils"

// Helper function to build configuration object from parameters
function buildConfigurationObject(docs: QueryDocumentSnapshot[], country?: string): Record<string, any> {
  const config: Record<string, any> = {}

  docs.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data()

    // Validate required fields and check if active
    if (!data || typeof data.key !== "string" || data.isActive === false) {
      logger.warn(`Skipping invalid or inactive parameter document: ${doc.id}`)
      return
    }

    const parameterData: ParameterData = {
      id: doc.id,
      key: data.key,
      value: data.value,
      description: data.description,
      overrides: data.overrides,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastUpdatedBy: data.lastUpdatedBy,
    }

    const key = parameterData.key
    const value = resolveParameterValue(parameterData, country)
    config[key] = value
  })

  return config
}

// Mobile client configuration endpoint - gets parameters and resolves overrides
export const getClientConfig: ExpressController = async (req, res) => {
  try {
    const { country } = req.query // Get country from query parameters
    logger.database("Fetching client configuration")

    const parametersSnapshot = await db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).get()
    const config = buildConfigurationObject(parametersSnapshot.docs, country as string)

    logger.api(
      `Client configuration retrieved with ${Object.keys(config).length} parameters${
        country ? ` for country: ${country}` : ""
      }`
    )
    res.status(200).json(config)
  } catch (error) {
    logger.errorWithContext("Error fetching client configuration", error)
    res.status(500).json({ error: "Internal server error", message: "Error fetching configuration." })
  }
}

// Helper function to create parameter object
function createParameterObject(body: any, uid: string, isUpdate = false): any {
  const { key, value, description, overrides } = body

  // Prepare the basic parameter data
  const parameterData: ParameterData = {
    key,
    value,
    description,
    overrides: overrides || {},
  }

  // Use utility to ensure proper migration and consistency
  const preparedData = prepareParameterForStorage(parameterData)

  // Add metadata
  const finalData: any = {
    ...preparedData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdatedBy: uid,
    isActive: preparedData.isActive !== undefined ? preparedData.isActive : true,
  }

  if (!isUpdate) {
    finalData.createdAt = admin.firestore.FieldValue.serverTimestamp()
  }

  return finalData
}

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

export const addParameter: ExpressController = async (req, res) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user!
    logger.database("Adding new parameter")

    const newParameter = createParameterObject(req.body, uid)
    const docRef = await db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).add(newParameter)

    logger.audit(
      "Parameter Created",
      {
        parameterId: docRef.id,
        parameterKey: req.body.key,
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

    logger.database("Updating parameter")
    const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

    await db.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(parameterRef)

      if (!doc.exists) {
        throw new Error("Parameter not found.")
      }

      const existingData = doc.data()
      if (!existingData) {
        throw new Error("Parameter data is empty.")
      }

      logger.database("Processing parameter update")

      // Merge existing overrides with new data to preserve overrides
      const mergedRequestBody = {
        ...req.body,
        // Preserve existing overrides if not provided in the update request
        overrides: req.body.overrides !== undefined ? req.body.overrides : existingData.overrides || {},
      }

      // Update the parameter with new timestamp
      const updatedParameter = createParameterObject(mergedRequestBody, uid, true)
      transaction.update(parameterRef, updatedParameter)
    })

    logger.audit(
      "Parameter Updated",
      {
        parameterId: id,
        parameterKey: req.body.key,
      },
      uid
    )

    res.status(200).json({ message: "Parameter updated successfully." })
  } catch (error) {
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
      res.status(400).json({ error: "Bad request", message: "Parameter ID is required" })
      return
    }

    // uid not needed for deletion operation

    logger.database("Deleting parameter")
    const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

    let parameterKey = "unknown"
    await db.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(parameterRef)

      if (!doc.exists) {
        throw new Error("Parameter not found.")
      }

      const existingData = doc.data()
      if (!existingData) {
        throw new Error("Parameter data is empty.")
      }

      parameterKey = existingData.key || "unknown"
      logger.database("Processing parameter deletion")

      // Delete the parameter
      transaction.delete(parameterRef)
    })

    logger.audit("Parameter Deleted", {
      parameterId: id,
      parameterKey: parameterKey,
    })

    res.status(200).json({ message: "Parameter deleted successfully." })
  } catch (error) {
    logger.errorWithContext("Error deleting parameter", error, { id: req.params.id || "unknown" })
    if (error instanceof Error) {
      if (error.message === "Parameter not found.") {
        res.status(404).json({ error: "Not found", message: error.message })
        return
      }
    }
    res.status(500).json({ error: "Internal server error", message: "Error deleting parameter." })
  }
}
