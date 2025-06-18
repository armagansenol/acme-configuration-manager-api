# ACME Configuration Manager API

A robust, enterprise-grade configuration management API for dynamic application parameters with advanced caching, security, and monitoring features.

## Table of Contents
- [✨ Key Features](#-key-features)
- [📡 API Documentation](#-api-documentation)
- [🛠️ Local Development](#️-local-development)
  - [Prerequisites](#prerequisites)
  - [Quick Setup](#quick-setup)
  - [Environment Variables](#environment-variables)
  - [Available Scripts](#available-scripts)
- [🔐 Authentication & Security](#-authentication--security)
- [🚀 API Endpoints](#-api-endpoints)
- [📊 Parameter Structure](#-parameter-structure)
- [🚨 Error Handling & Monitoring](#-error-handling--monitoring)
- [🔄 Advanced Features](#-advanced-features)
- [🚀 Production Deployment](#-production-deployment)


## ✨ Key Features

### 🚀 **Performance & Caching**
- **Redis Caching** - High-performance in-memory caching with TTL and fallback.
- **Optimized Queries** - Database indexes and query optimization for fast data retrieval.
- **Connection Pooling** - Efficient management of database resources.
- **Cache Patterns** - Implements cache-aside, write-through, and proactive invalidation.

### 🔒 **Enterprise Security**
- **Multi-layer Authentication** - Firebase Auth for admin users and API keys for client applications.
- **Deep Input Validation** - Protection against SQL/NoSQL injection, XSS, and other threats.
- **Rate Limiting** - Multiple tiers for different user roles and operations.
- **Security Event Logging** - Comprehensive audit trails for threat detection.
- **Prototype Pollution Protection** - Advanced object validation to prevent security vulnerabilities.

### 📊 **Monitoring & Observability**
- **Health Checks** - Comprehensive health monitoring for all system components.
- **Performance Metrics** - Real-time tracking of request timing, memory usage, and system stats.
- **Structured Logging** - Detailed request/response logging with correlation IDs for easy debugging.
- **Error Tracking** - Custom error classes with appropriate HTTP status codes.

### 🔄 **Data Management**
- **Country-specific Overrides** - Easily manage localized configuration values.
- **Version-Based Conflict Detection** - Optimistic locking to prevent data loss during concurrent updates.
- **Transaction Safety** - ACID-compliant database operations with timeout protection.

### 🏗️ **Developer Experience**
- **TypeScript** - Full type safety with strict compiler options.
- **Modular Architecture** - Clean separation of concerns for better maintainability.
- **Interactive API Documentation** - Self-documenting endpoints with Swagger UI.
- **Development Tools** - Hot-reloading, linting, and optimized build process.

## 📡 API Documentation

This project uses Swagger for interactive API documentation. When the development server is running, you can access the Swagger UI at:

**[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

The documentation provides detailed information about all available endpoints, including request parameters, response schemas, and authentication requirements. You can also execute API requests directly from the browser.

## 🛠️ Local Development

### Prerequisites
- **Node.js 18+**
- **Redis Server** (can be installed with `brew install redis` on macOS)
- **Firebase Project** with Admin SDK credentials.
- **npm** or **yarn**

### Quick Setup
```bash
# 1. Clone the repository
git clone <repository-url>
cd acme-configuration-manager-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.example .env
# Edit .env with your Firebase credentials, API keys, and other settings.

# 4. Start Redis (if not already running)
# On macOS with Homebrew:
brew services start redis

# 5. Start the development server
npm run dev
```
The API will be available at `http://localhost:3000`.

### Environment Variables
The `.env` file is used to configure the application. Refer to `env.example` for the full list of required variables.

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Admin SDK (as separate environment variables)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com

# Security
CLIENT_CONFIG_API_KEY=your-secret-api-key-minimum-32-characters-long
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com

# Redis Caching
REDIS_URL=redis://localhost:6379

# Rate Limiting (optional - has sensible defaults)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Debug Mode (development only)
DEBUG=true
```

### Available Scripts

- `npm run dev`: Starts the development server with hot-reloading using `ts-node` and Node's `--watch` flag.
- `npm run dev:legacy`: Legacy development server using ts-node with dotenv (fallback option).
- `npm start`: Starts the production-ready server from the compiled JavaScript files in `dist/`. Requires `npm run build` to be run first.
- `npm run build`: Compiles the TypeScript source code into JavaScript in the `dist/` directory.
- `npm run vercel-build`: Build command optimized for Vercel deployment (alias for `npm run build`).
- `npm run lint`: Lints the source code using ESLint to check for code quality and style issues.
- `npm run lint:fix`: Lints the code and automatically fixes issues where possible.
- `npm run clean`: Removes the `dist/` directory to ensure clean builds.
- `npm run test:conflict`: Runs conflict detection tests to verify optimistic locking functionality.
- `npm run test:all`: Runs comprehensive feature tests across all API endpoints.

## 🔐 Authentication & Security

### Firebase Authentication (Admin Operations)
Admin endpoints are secured using Firebase Authentication (JWT Bearer tokens).

```bash
curl -H "Authorization: Bearer <firebase-id-token>" \
     https://your-api.onrender.com/api/parameters
```

### API Key Authentication (Client Access)
Client-facing endpoints are secured with API keys. The key must be passed in the `x-api-key` header.

```bash
curl -H "x-api-key: your-api-key" \
     https://your-api.onrender.com/api/client-config?country=US
```

### Rate Limiting Tiers
- **General API**: 100 requests / 15 minutes
- **Admin Operations**: 50 requests / 15 minutes
- **Client Config**: 30 requests / minute
- **Sensitive Operations**: 10 requests / hour

## 🚀 API Endpoints

### 🔍 Health & Monitoring
- `GET /health`: Comprehensive health check (database, cache, auth).
- `GET /health/quick`: Simple OK/ERROR for load balancers.
- `GET /health/ready`: Kubernetes readiness probe.
- `GET /health/live`: Kubernetes liveness probe.
- `GET /health/cache`: Redis cache service status.
- `GET /metrics`: System performance metrics.

### 🔐 Admin Endpoints (Firebase Auth Required)
- `GET /api/parameters`: Get all parameters with query filters.
- `GET /api/parameters/:id`: Get a single parameter by ID.
- `POST /api/parameters`: Create a new parameter.
- `PUT /api/parameters/:id`: Update a parameter (with conflict detection).
- `DELETE /api/parameters/:id`: Delete a parameter.
- `GET /api/parameters/:id/overrides/country`: Get all country overrides for a parameter.
- `PUT /api/parameters/:id/overrides/country/:countryCode`: Set or update a country-specific override.
- `DELETE /api/parameters/:id/overrides/country/:countryCode`: Delete a country-specific override.

### 📱 Client Endpoints (API Key Required)
- `GET /api/client-config?country=US`: Get the optimized client configuration for a specific country.

## 📊 Parameter Structure
The `Parameter` object in the database can have a rich structure. The example below shows a full object. API responses may vary based on the endpoint.

```json
{
  "id": "feature_flag_1",
  "key": "enable_new_feature",
  "value": true,
  "description": "Enable the new feature for users",
  "version": 5,
  "overrides": {
    "country": {
      "US": true,
      "FR": false,
      "DE": "custom_value"
    }
  },
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastUpdatedBy": "admin@company.com"
}
```

## 🚨 Error Handling & Monitoring

### Custom Error Classes
The API uses custom error classes to provide meaningful HTTP status codes.
- `ParameterNotFoundError` -> `404 Not Found`
- `ValidationError` -> `400 Bad Request`
- `DatabaseError` -> `500 Internal Server Error`
- `ConflictError` -> `409 Conflict`
- `AuthenticationError` -> `401 Unauthorized`
- `RateLimitError` -> `429 Too Many Requests`

### Health Check Response Example
```json
{
  "status": "healthy",
  "timestamp": "2024-07-26T10:00:00.000Z",
  "services": {
    "database": { "status": "healthy", "latency": 45 },
    "cache": { "status": "healthy", "keyCount": 156 },
    "authentication": { "status": "healthy" }
  }
}
```

## 🔄 Advanced Features

### Conflict Detection & Resolution
The API uses optimistic locking to prevent race conditions. When updating a parameter, you must provide the `lastKnownVersion`. If the version on the server is different, a `409 Conflict` error is returned.

```http
PUT /api/parameters/123
Content-Type: application/json

{
  "lastKnownVersion": 5,
  "value": false
}
```
**Conflict Response (409):**
```json
{
  "error": "Conflict",
  "message": "The resource has been modified by another process.",
  "conflictDetails": {
    "currentVersion": 7,
    "providedVersion": 5
  }
}
```

## 🚀 Production Deployment

### Render.com with Redis (Recommended)
This project includes a `render.yaml` file for easy deployment on [Render](https://render.com/).

```yaml
services:
  # Redis Service
  - type: redis
    name: acme-config-redis
    region: oregon # or your preferred region
    plan: starter

  # Web Service
  - type: web
    name: acme-config-api
    env: node
    # ... other configurations
    # Render automatically sets the REDIS_URL environment variable
```

**Deployment Steps:**
1. Create a new "Blueprint" service on your Render dashboard.
2. Connect the GitHub/GitLab repository.
3. Render will automatically provision and connect the Redis instance.
4. Ensure your production environment variables (like Firebase credentials) are set in the Render dashboard.

## 📈 Production Readiness Checklist

### ✅ **Security**
- [x] Multi-layer authentication (Firebase + API keys)
- [x] Deep input validation with injection protection
- [x] Rate limiting with multiple tiers
- [x] Security event logging and audit trails
- [x] Prototype pollution protection
- [x] Secure headers (Helmet.js)
- [x] CORS configuration

### ✅ **Performance**
- [x] Redis caching with fallback handling
- [x] Database query optimization
- [x] Connection pooling
- [x] Request performance monitoring
- [x] Memory usage tracking

### ✅ **Reliability**
- [x] Comprehensive health checks
- [x] Graceful error handling
- [x] Transaction safety with timeouts
- [x] Service failover (cache → database)
- [x] Request correlation and tracing

### ✅ **Observability**
- [x] Structured logging with Winston
- [x] Health monitoring endpoints
- [x] Performance metrics collection
- [x] Error tracking and alerting
- [x] Audit trail logging

### ✅ **Developer Experience**
- [x] TypeScript with strict configuration
- [x] Comprehensive testing framework
- [x] Development hot reload
- [x] Code linting and formatting
- [x] API documentation

## 🔧 Development Scripts

```bash
npm run dev          # Development server with hot reload
npm run dev:legacy   # Legacy development server (fallback)
npm run build        # Production build
npm run vercel-build # Vercel-optimized build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run test:conflict # Test conflict detection
npm run test:all     # Run all feature tests
npm run clean        # Clean build directory
```

## 📊 Monitoring & Maintenance

### Health Check URLs
- **Load Balancer**: `GET /health/quick` → `{"status": "ok"}`
- **Kubernetes Readiness**: `GET /health/ready`
- **Kubernetes Liveness**: `GET /health/live`
- **Detailed Health**: `GET /health`
- **Cache Status**: `GET /health/cache`
- **Metrics**: `GET /metrics`

### Redis Management
```bash
# Check Redis status
redis-cli ping

# View cache statistics
curl /health/cache

# Clear cache (if needed)
redis-cli flushall
```

### Log Monitoring
Look for these log patterns:
- **Security Events**: `SECURITY_EVENT` entries
- **Performance Issues**: `SLOW_REQUEST` entries  
- **Cache Issues**: `Cache fallback` warnings
- **Rate Limits**: `Rate limit exceeded` entries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run linting: `npm run lint:fix`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🆘 Troubleshooting

### Redis Connection Issues
```bash
# Start Redis locally
brew services start redis

# Check Redis connection
redis-cli ping  # Should return "PONG"

# View Redis logs
brew services info redis
```

### Health Check Failures
```bash
# Check individual services
curl /health/cache    # Redis status
curl /health/ready    # Database connectivity
curl /metrics         # System resources
```

### Performance Issues
```bash
# Monitor slow requests
grep "SLOW_REQUEST" logs/app.log

# Check memory usage
curl /metrics | jq '.metrics.memory'

# Cache hit rates
curl /health/cache | jq '.stats'
```

For more help, check the [Issues](../../issues) page or create a new issue with detailed logs. 