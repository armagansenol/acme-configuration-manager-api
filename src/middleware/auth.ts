import { Request, Response, NextFunction } from "express"
import { admin } from "../config/firebase"
import { logger } from "../utils/logger"
import { AuthenticatedRequest } from "../types"

// Firebase ID Token Authentication Middleware
export const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger.auth(`Middleware called for ${req.method} ${req.path}`)

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.auth("Authentication failed: No token provided or invalid format")
    res.status(401).send("Unauthorized: No token provided.")
    return
  }

  const idToken = authHeader.split("Bearer ")[1]
  if (!idToken) {
    logger.auth("Authentication failed: Invalid token format")
    res.status(401).send("Unauthorized: Invalid token format.")
    return
  }

  logger.auth(`Token received, attempting verification`)

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    logger.auth(`Token verified successfully for user ID: ${decodedToken.uid}`)
    req.user = decodedToken
    next()
  } catch (error) {
    logger.errorWithContext("Firebase token verification failed", error)
    res.status(403).send("Unauthorized: Invalid token.")
  }
}

// Mobile API Key Authentication Middleware
export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  logger.auth(`API Key middleware called for ${req.method} ${req.path}`)

  const apiKey = req.headers.authorization

  if (!apiKey) {
    logger.auth("API key authentication failed: No API key provided")
    res.status(401).json({ error: "Unauthorized: No API key provided" })
    return
  }

  if (!apiKey.startsWith("Bearer ")) {
    logger.auth("API key authentication failed: Invalid format")
    res.status(401).json({ error: "Unauthorized: Invalid API key format" })
    return
  }

  // Validate API key length to prevent timing attacks
  if (!process.env.MOBILE_API_KEY || process.env.MOBILE_API_KEY.length < 32) {
    logger.error("MOBILE_API_KEY is not set or too short - server configuration error")
    res.status(500).json({ error: "Server configuration error" })
    return
  }

  // Use constant-time comparison to prevent timing attacks
  const providedKey = apiKey.slice(7)
  const expectedKey = process.env.MOBILE_API_KEY

  if (providedKey.length !== expectedKey.length) {
    logger.auth("API key authentication failed: Invalid length")
    res.status(401).json({ error: "Unauthorized: Invalid API key" })
    return
  }

  // Constant-time comparison
  let isValid = true
  for (let i = 0; i < expectedKey.length; i++) {
    if (providedKey[i] !== expectedKey[i]) {
      isValid = false
    }
  }

  if (!isValid) {
    logger.auth("API key authentication failed: Invalid key")
    res.status(401).json({ error: "Unauthorized: Invalid API key" })
    return
  }

  logger.auth("API key validated successfully")
  next()
}
