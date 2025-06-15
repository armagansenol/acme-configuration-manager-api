// Parameter utility functions to handle data transformation

export interface ParameterOverrides {
  country?: Record<string, any>
  // Future override types can be added here (e.g., device, region, platform, etc.)
}

export interface ParameterData {
  id?: string
  key: string
  value: any
  description?: string
  overrides?: ParameterOverrides
  isActive?: boolean
  createdAt?: any
  updatedAt?: any
  lastUpdatedBy?: string
}

/**
 * Resolves parameter value with country-specific overrides
 */
export function resolveParameterValue(parameterData: ParameterData, country?: string): any {
  let value = parameterData.value // Default value

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

  return prepared
}
