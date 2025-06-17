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
  logger.auth(`Authentication check for ${req.method} ${req.path}`)

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.securityEvent(
      "Authentication Failed",
      {
        reason: "Missing or invalid authorization header",
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
      },
      "low"
    )
    res.status(401).json({ error: "Unauthorized", message: "No token provided or invalid format" })
    return
  }

  const idToken = authHeader.split("Bearer ")[1]
  if (!idToken) {
    logger.securityEvent(
      "Authentication Failed",
      {
        reason: "Invalid bearer token format",
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
      },
      "low"
    )
    res.status(401).json({ error: "Unauthorized", message: "Invalid token format" })
    return
  }

  logger.auth("Verifying Firebase token")

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    logger.userAction("Authentication Success", decodedToken.uid, {
      endpoint: `${req.method} ${req.path}`,
    })
    req.user = decodedToken
    next()
  } catch (error) {
    logger.securityEvent(
      "Firebase Token Verification Failed",
      {
        endpoint: `${req.method} ${req.path}`,
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      },
      "medium"
    )
    res.status(403).json({ error: "Forbidden", message: "Invalid token" })
  }
}

// Mobile API Key Authentication Middleware
export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  logger.auth(`API Key check for ${req.method} ${req.path}`)

  const apiKey = req.headers["x-api-key"] as string | undefined

  if (!apiKey) {
    logger.securityEvent(
      "API Key Authentication Failed",
      {
        reason: "No API key provided",
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
      },
      "low"
    )
    res.status(401).json({ error: "Unauthorized", message: "No API key provided" })
    return
  }

  // Validate API key length to prevent timing attacks
  if (!process.env.MOBILE_API_KEY || process.env.MOBILE_API_KEY.length < 32) {
    logger.securityEvent(
      "Server Configuration Error",
      {
        reason: "MOBILE_API_KEY not configured properly",
        endpoint: `${req.method} ${req.path}`,
      },
      "critical"
    )
    res.status(500).json({ error: "Server configuration error" })
    return
  }

  // Use constant-time comparison to prevent timing attacks
  const providedKey = apiKey
  const expectedKey = process.env.MOBILE_API_KEY

  if (providedKey.length !== expectedKey.length) {
    logger.securityEvent(
      "API Key Authentication Failed",
      {
        reason: "Invalid key length",
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
      },
      "medium"
    )
    res.status(401).json({ error: "Unauthorized", message: "Invalid API key" })
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
    logger.securityEvent(
      "API Key Authentication Failed",
      {
        reason: "Invalid API key",
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
        keyPrefix: providedKey.substring(0, 4) + "***", // Only log first 4 chars
      },
      "medium"
    )
    res.status(401).json({ error: "Unauthorized", message: "Invalid API key" })
    return
  }

  logger.audit("API Key Authentication Success", {
    endpoint: `${req.method} ${req.path}`,
    keyPrefix: providedKey.substring(0, 4) + "***",
  })
  next()
}
