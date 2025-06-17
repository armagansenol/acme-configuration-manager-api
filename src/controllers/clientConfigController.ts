import { cacheService, CacheKeys } from "../services/cacheService"
import { ExpressController, isCustomError } from "../types"
import { buildConfigurationObject, getParametersCollectionRef } from "../utils/configHelpers"
import { logger } from "../utils/logger"

// Mobile client configuration endpoint - gets parameters and resolves overrides with caching
export const getClientConfig: ExpressController = async (req, res) => {
  try {
    const { country } = req.query // Get country from query parameters
    const cacheKey = CacheKeys.CLIENT_CONFIG(country as string)

    logger.database("Fetching client configuration")

    // Try to get from cache first
    const config = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.database("Cache miss - fetching from database")
        const query = getParametersCollectionRef({ activeOnly: true })
        const parametersSnapshot = await query.get()
        return buildConfigurationObject(parametersSnapshot.docs, country as string)
      },
      5 * 60 // 5 minutes TTL
    )

    logger.api(
      `Client configuration retrieved with ${Object.keys(config).length} parameters${
        country ? ` for country: ${country}` : ""
      }`
    )
    res.status(200).json(config)
  } catch (error) {
    if (isCustomError(error)) {
      throw error
    }
    logger.errorWithContext("Error fetching client configuration", error)
    res.status(500).json({ error: "Internal server error", message: "Error fetching configuration." })
  }
}
