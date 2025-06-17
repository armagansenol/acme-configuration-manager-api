// Parameter utility functions to handle data transformation

import { admin } from "../config/firebase"

export interface ParameterOverrides {
  country?: Record<string, any>
  // Future override types can be added here (e.g., device, region, platform, etc.)
}

export type ParameterValue = string | number | boolean | object | null

export interface ParameterData {
  id?: string
  key: string
  value: ParameterValue
  description?: string
  overrides?: ParameterOverrides
  isActive?: boolean
  version: number
  createdAt?: admin.firestore.Timestamp
  updatedAt?: admin.firestore.Timestamp
  lastUpdatedBy?: string
}

export interface ParameterBody {
  key: string
  value: ParameterValue
  description?: string
  overrides?: ParameterOverrides
  isActive?: boolean
  lastKnownVersion?: number
  forceUpdate?: boolean
}

/**
 * Resolves parameter value with country-specific overrides
 */
export function resolveParameterValue(parameterData: ParameterData, country?: string): ParameterValue {
  let value: ParameterValue = parameterData.value // Default value

  if (country && typeof country === "string") {
    const countryCode = country.toUpperCase()

    // Check overrides structure
    if (parameterData.overrides?.country?.[countryCode] !== undefined) {
      value = parameterData.overrides.country[countryCode]
    }
  }

  return value
}

/**
 * Prepares parameter data for database storage
 */
export function prepareParameterForStorage(data: ParameterData): ParameterData {
  const prepared = { ...data }

  // Ensure overrides object exists
  if (!prepared.overrides) {
    prepared.overrides = {}
  }

  // Ensure version is set (default to 0 for new parameters)
  if (prepared.version === undefined) {
    prepared.version = 0
  }

  return prepared
}

/**
 * Increment version for updates
 */
export function incrementVersion(currentVersion: number): number {
  return currentVersion + 1
}
