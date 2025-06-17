import { Request, Response } from "express"
import { DecodedIdToken } from "firebase-admin/auth"

/**
 * Authenticated Request interface
 * Extends Express Request with Firebase user information
 */
export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken
}

/**
 * Express Controller type
 */
export type ExpressController = (req: Request, res: Response) => Promise<void>

/**
 * Firestore collection names
 */
export const FIRESTORE_COLLECTIONS = {
  PARAMETERS: "parameters",
} as const

// Re-export Firebase types
export * from "./firebase"

// Re-export error classes
export * from "./errors"
