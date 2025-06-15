import { Request } from "express"
import { DecodedIdToken } from "firebase-admin/auth"

/**
 * Authenticated Request interface
 * Extends Express Request with Firebase user information
 */
export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken
}

// Re-export Firebase types
export * from "./firebase"
