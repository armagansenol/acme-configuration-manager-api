import { admin } from "../config/firebase"
import { logger } from "./logger"
import { cacheService, CacheKeys } from "../services/cacheService"

/**
 * Resolves a user ID to the user's email address using Firebase Auth with caching
 * @param uid The Firebase user ID
 * @returns The user's email address or the original UID if resolution fails
 */
export async function resolveUserIdToEmail(uid: string): Promise<string> {
  if (!uid) {
    return "unknown"
  }

  const cacheKey = CacheKeys.USER_EMAIL(uid)

  try {
    // Use cache-aside pattern for performance
    const email = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const userRecord = await admin.auth().getUser(uid)
        if (userRecord.email) {
          logger.debug(`Resolved user ID ${uid} to email ${userRecord.email} from source`)
          return userRecord.email
        } else {
          logger.warn(`User ${uid} has no email address`)
          return uid // Fallback to UID if no email, cache this result
        }
      },
      24 * 60 * 60 // Cache for 24 hours
    )
    return email || uid // Fallback to UID if cache returns null/undefined
  } catch (error) {
    logger.warn(`Failed to resolve user ID ${uid} to email: ${error}`)
    return uid // Fallback to UID if resolution fails
  }
}

/**
 * Resolves multiple user IDs to email addresses in parallel with caching
 * @param uids Array of Firebase user IDs
 * @returns Map of UID to email address
 */
export async function resolveMultipleUserIdsToEmails(uids: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  // Filter out empty/null UIDs
  const validUids = uids.filter((uid) => uid && uid.trim() !== "")

  if (validUids.length === 0) {
    return results
  }

  try {
    // Resolve all UIDs in parallel
    const promises = validUids.map(async (uid) => {
      const email = await resolveUserIdToEmail(uid)
      return { uid, email }
    })

    const resolvedUsers = await Promise.all(promises)

    resolvedUsers.forEach(({ uid, email }) => {
      results.set(uid, email)
    })

    logger.debug(`Resolved ${resolvedUsers.length} user IDs to emails`)
  } catch (error) {
    logger.errorWithContext("Error resolving multiple user IDs to emails", error)
  }

  return results
}
