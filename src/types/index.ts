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
 * Express Controller Type
 * Standard controller function type for Express routes
 */
export type ExpressController = (req: Request, res: Response) => Promise<void>

// Re-export Firebase types
export * from "./firebase"
