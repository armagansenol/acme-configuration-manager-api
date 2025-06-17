import { QueryDocumentSnapshot, Transaction } from "firebase-admin/firestore"
import { admin, db } from "../config/firebase"
import { FIRESTORE_COLLECTIONS, ParameterNotFoundError, DatabaseError, ValidationError } from "../types"
import { logger } from "./logger"
import {
  ParameterData,
  resolveParameterValue,
  prepareParameterForStorage,
  incrementVersion,
  ParameterBody,
  ParameterValue,
  ParameterOverrides,
} from "./parameterUtils"

/**
 * Helper functions for configuration operations
 * Split from main controller for better testability and maintainability
 */

/**
 * Validate if a document represents a valid active parameter
 */
export function isValidParameterDocument(data: Partial<ParameterData>, docId: string): data is ParameterData {
  if (!data || typeof data.key !== "string" || data.isActive === false) {
    logger.warn(`Skipping invalid or inactive parameter document: ${docId}`)
    return false
  }
  return true
}

/**
 * Transform a Firestore document to ParameterData object
 */
export function transformDocumentToParameterData(doc: QueryDocumentSnapshot): ParameterData {
  const data = doc.data()
  return {
    id: doc.id,
    key: data.key,
    value: data.value,
    description: data.description,
    overrides: data.overrides,
    isActive: data.isActive,
    version: data.version || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastUpdatedBy: data.lastUpdatedBy,
  }
}

/**
 * Build configuration object from parameter documents (simple country override → default)
 */
export function buildConfigurationObject(
  docs: QueryDocumentSnapshot[],
  country?: string
): Record<string, ParameterValue> {
  const config: Record<string, ParameterValue> = {}

  docs.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data() as Partial<ParameterData>

    if (!isValidParameterDocument(data, doc.id)) {
      return
    }

    const parameterData = transformDocumentToParameterData(doc)
    const key = parameterData.key
    const value = resolveParameterValue(parameterData, country)
    config[key] = value
  })

  return config
}

/**
 * Detect conflicting fields between update data and existing data
 */
export function detectConflictingFields(updateData: Partial<ParameterBody>, existingData: ParameterData): string[] {
  const conflicts: string[] = []

  const fieldsToCheck: (keyof ParameterBody)[] = ["key", "value", "description", "isActive"]
  for (const field of fieldsToCheck) {
    if (updateData[field] !== undefined && updateData[field] !== existingData[field]) {
      conflicts.push(field)
    }
  }

  // Check override conflicts
  if (updateData.overrides && existingData.overrides) {
    const updateCountries = Object.keys(updateData.overrides.country || {})
    const existingCountries = Object.keys(existingData.overrides.country || {})

    for (const country of [...updateCountries, ...existingCountries]) {
      const updateVal = updateData.overrides.country?.[country]
      const existingVal = existingData.overrides.country?.[country]

      if (updateVal !== undefined && updateVal !== existingVal) {
        conflicts.push(`overrides.country.${country}`)
      }
    }
  }

  return conflicts
}

/**
 * Create parameter object for database storage
 */
export function createParameterObject(
  body: ParameterBody,
  uid: string,
  isUpdate = false,
  currentVersion = 0
): Omit<ParameterData, "id"> {
  const { key, value, description, overrides, isActive } = body

  // Prepare the basic parameter data
  const parameterData: ParameterData = {
    key,
    value,
    description: description || "",
    overrides: overrides || {},
    isActive: isActive !== undefined ? isActive : true,
    version: isUpdate ? incrementVersion(currentVersion) : 0,
  }

  // Use utility to ensure proper migration and consistency
  const preparedData = prepareParameterForStorage(parameterData)

  // Add metadata
  const finalData: any = {
    ...preparedData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdatedBy: uid,
  }

  if (!isUpdate) {
    finalData.createdAt = admin.firestore.FieldValue.serverTimestamp()
  }

  return finalData
}

/**
 * Fetch and validate parameter document
 */
export async function fetchParameterDocument(id: string): Promise<{
  doc: QueryDocumentSnapshot
  data: ParameterData
}> {
  if (!id) {
    throw new ValidationError("Parameter ID is required", "id")
  }

  logger.database(`Fetching parameter ${id}`)
  const parameterRef = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).doc(id)

  try {
    const doc = await parameterRef.get()

    if (!doc.exists) {
      logger.warn(`Parameter ${id} not found`)
      throw new ParameterNotFoundError(id)
    }

    const data = doc.data()
    if (!data) {
      throw new DatabaseError(`Parameter ${id} has no data`, "fetch")
    }

    return { doc: doc as QueryDocumentSnapshot, data: data as ParameterData }
  } catch (error) {
    if (error instanceof ParameterNotFoundError) {
      throw error
    }
    logger.errorWithContext("Failed to fetch parameter document", error, { id })
    throw new DatabaseError(`Failed to fetch parameter ${id}`, "fetch")
  }
}

/**
 * Execute database transaction with timeout protection
 */
export async function executeTransactionWithTimeout<T>(
  transactionFn: (transaction: Transaction) => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Transaction timeout")), timeoutMs)
  })

  const transactionPromise = db.runTransaction(transactionFn)

  try {
    return await Promise.race([transactionPromise, timeoutPromise])
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      logger.errorWithContext("Transaction timeout", error)
      throw new DatabaseError("Transaction timeout", "transaction")
    }
    throw error
  }
}

/**
 * Get filtered parameters collection reference
 */
export function getParametersCollectionRef(
  options: {
    activeOnly?: boolean
    orderBy?: { field: string; direction: "asc" | "desc" }
    limit?: number
  } = {}
) {
  let query = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS) as any

  if (options.activeOnly) {
    query = query.where("isActive", "==", true)
  }

  if (options.orderBy) {
    query = query.orderBy(options.orderBy.field, options.orderBy.direction)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  return query
}

/**
 * Validate parameter operation permissions
 */
export function validateParameterOperationPermissions(
  operation: "create" | "read" | "update" | "delete",
  parameterData?: Partial<ParameterData>,
  userContext?: { uid: string; email?: string }
): void {
  // Add any business logic for parameter operation permissions
  // For now, this is a placeholder for future authorization logic

  if (!userContext?.uid) {
    throw new ValidationError("User context required for parameter operations", "user")
  }

  // Example: Prevent deletion of critical parameters
  if (operation === "delete" && parameterData?.key?.startsWith("CRITICAL_")) {
    throw new ValidationError("Cannot delete critical parameters", "operation")
  }

  // Example: Restrict certain operations to admin users
  // if (operation === 'delete' && !userContext.email?.endsWith('@admin.com')) {
  //   throw new ValidationError("Insufficient permissions for delete operation", "permissions")
  // }
}

/**
 * Sanitize parameter data for public API responses
 */
export function sanitizeParameterForResponse(
  parameter: ParameterData,
  includeMetadata: boolean = true
): Partial<ParameterData> {
  const sanitized: Partial<ParameterData> = {
    id: parameter.id,
    key: parameter.key,
    value: parameter.value,
    description: parameter.description,
    overrides: parameter.overrides,
    isActive: parameter.isActive,
  }

  if (includeMetadata) {
    const { version, createdAt, updatedAt, lastUpdatedBy } = parameter
    return {
      ...sanitized,
      version,
      createdAt,
      updatedAt,
      lastUpdatedBy,
    }
  }

  return sanitized
}

/**
 * Merge overrides intelligently, preserving existing values while adding new ones
 */
export function mergeOverrides(
  existingOverrides: ParameterOverrides,
  newOverrides: ParameterOverrides,
  operation: "merge" | "replace" = "merge"
): ParameterOverrides {
  if (operation === "replace") {
    return newOverrides
  }

  const merged: ParameterOverrides = { ...existingOverrides }

  // Merge country overrides
  if (newOverrides.country) {
    merged.country = {
      ...existingOverrides.country,
      ...newOverrides.country,
    }
  }

  return merged
}

/**
 * Remove specific country override
 */
export function removeCountryOverride(overrides: ParameterOverrides, countryCode: string): ParameterOverrides {
  const updated = { ...overrides }

  if (updated.country) {
    const { [countryCode.toUpperCase()]: removed, ...remaining } = updated.country
    updated.country = remaining
  }

  return updated
}

/**
 * Set specific country override
 */
export function setCountryOverride(overrides: ParameterOverrides, countryCode: string, value: any): ParameterOverrides {
  const updated = { ...overrides }

  if (!updated.country) {
    updated.country = {}
  }

  updated.country[countryCode.toUpperCase()] = value

  return updated
}

/**
 * Validate country override operation
 */
export function validateCountryOverrideOperation(
  countryCode: string,
  value?: any,
  operation: "set" | "delete" = "set"
): void {
  // Validate country code format
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode.toUpperCase())) {
    throw new ValidationError("Invalid country code format. Must be 2 uppercase letters.", "countryCode")
  }

  // Validate value for set operations
  if (operation === "set" && value === undefined) {
    throw new ValidationError("Value is required for setting country override", "value")
  }
}

/**
 * Check if a parameter key already exists
 */
export async function checkParameterKeyExists(
  key: string,
  excludeId?: string
): Promise<{
  exists: boolean
  existingParameter?: { id: string; key: string }
}> {
  try {
    const query = db.collection(FIRESTORE_COLLECTIONS.PARAMETERS).where("key", "==", key)
    const snapshot = await query.get()

    if (snapshot.empty) {
      return { exists: false }
    }

    // If we're updating a parameter, exclude the current parameter from the check
    const existingDocs = snapshot.docs.filter((doc) => doc.id !== excludeId)

    if (existingDocs.length === 0) {
      return { exists: false }
    }

    // Get the first existing document (we know length > 0)
    const existingDoc = existingDocs[0]!
    return {
      exists: true,
      existingParameter: {
        id: existingDoc.id,
        key: existingDoc.data().key,
      },
    }
  } catch (error) {
    logger.errorWithContext("Error checking parameter key existence", error, { key })
    throw new DatabaseError(`Failed to check parameter key existence: ${key}`, "key_check")
  }
}
