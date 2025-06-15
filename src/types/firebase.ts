import { DocumentData, FirestoreDataConverter } from "firebase-admin/firestore"

/**
 * Firebase Service Account Configuration
 */
export interface ServiceAccountConfig {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url?: string
  universe_domain: string
}

/**
 * Configuration Parameter Types
 */
export interface ConfigurationParameter {
  id?: string
  appId: string
  key: string
  value: string | number | boolean | object
  type: "string" | "number" | "boolean" | "object"
  description?: string
  defaultValue?: string | number | boolean | object
  country?: string
  environment?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  version: number
}

/**
 * Application Configuration
 */
export interface ApplicationConfig {
  id?: string
  appId: string
  appName: string
  version: string
  parameters: Record<string, ConfigurationParameter>
  countryOverrides?: Record<string, Partial<ConfigurationParameter>>
  environmentOverrides?: Record<string, Partial<ConfigurationParameter>>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Firestore Collection Names
 */
export const FIRESTORE_COLLECTIONS = {
  CONFIGURATIONS: "configurations",
  PARAMETERS: "parameters",
  AUDIT_LOGS: "audit_logs",
} as const

/**
 * Firestore Converter for Configuration Parameters
 */
export const configParameterConverter: FirestoreDataConverter<ConfigurationParameter> = {
  toFirestore(parameter: ConfigurationParameter): DocumentData {
    return {
      appId: parameter.appId,
      key: parameter.key,
      value: parameter.value,
      type: parameter.type,
      description: parameter.description,
      defaultValue: parameter.defaultValue,
      country: parameter.country,
      environment: parameter.environment,
      isActive: parameter.isActive,
      createdAt: parameter.createdAt,
      updatedAt: parameter.updatedAt,
      version: parameter.version,
    }
  },

  fromFirestore(snapshot): ConfigurationParameter {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      appId: data.appId,
      key: data.key,
      value: data.value,
      type: data.type,
      description: data.description,
      defaultValue: data.defaultValue,
      country: data.country,
      environment: data.environment,
      isActive: data.isActive,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      version: data.version || 1,
    }
  },
}
