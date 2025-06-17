/**
 * @swagger
 * components:
 *   schemas:
 *     HealthStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: healthy
 *         timestamp:
 *           type: string
 *           format: date-time
 *         services:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "database"
 *               status:
 *                 type: string
 *                 example: "healthy"
 *     Parameter:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         key:
 *           type: string
 *         value:
 *           type: string
 *         version:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     NewParameter:
 *       type: object
 *       required:
 *         - key
 *         - value
 *       properties:
 *         key:
 *           type: string
 *         value:
 *           type: string
 *     UpdateParameter:
 *       type: object
 *       required:
 *         - value
 *         - lastKnownVersion
 *       properties:
 *         value:
 *           type: string
 *         lastKnownVersion:
 *           type: integer
 *     CountryOverride:
 *       type: object
 *       required:
 *         - value
 *       properties:
 *         value:
 *           type: string
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *     apiKey:
 *       type: apiKey
 *       in: header
 *       name: x-api-key
 */
