# ACME Configuration Manager API

A robust, enterprise-grade configuration management API for dynamic application parameters with advanced caching, security, and monitoring features.

## ✨ Key Features

### 🚀 **Performance & Caching**
- **Redis Caching** - High-performance in-memory caching with TTL and fallback
- **Optimized Queries** - Database indexes and query optimization
- **Connection Pooling** - Efficient database resource management
- **Cache Patterns** - Get-or-set, invalidation patterns, and statistics

### 🔒 **Enterprise Security**
- **Multi-layer Authentication** - Firebase Auth for admins, API keys for clients
- **Deep Input Validation** - SQL injection, NoSQL injection, and script injection protection
- **Rate Limiting** - Multiple tiers (general, admin, client, sensitive operations)
- **Security Event Logging** - Comprehensive audit trails and threat detection
- **Prototype Pollution Protection** - Advanced object validation

### 📊 **Monitoring & Observability**
- **Health Checks** - Comprehensive system health monitoring
- **Performance Metrics** - Request timing, memory usage, and system stats
- **Request/Response Logging** - Detailed logging with correlation IDs
- **Error Tracking** - Custom error classes with proper HTTP status codes
- **Slow Query Detection** - Performance monitoring and alerting

### 🔄 **Data Management**
- **Country-specific Overrides** - Localized configuration values
- **Version-Based Conflict Detection** - Optimistic locking prevents data loss
- **Transaction Safety** - ACID compliance with timeout protection
- **Automatic Migration** - Seamless version field migration

### 🏗️ **Developer Experience**
- **TypeScript** - Full type safety with strict configuration
- **Modular Architecture** - Clean separation of concerns
- **Comprehensive Testing** - Unit tests for critical business logic
- **API Documentation** - Self-documenting endpoints
- **Development Tools** - Hot reload, linting, and build optimization

## 📡 API Endpoints

### 🔍 **Health & Monitoring**
- `GET /health` - Comprehensive health check (database, cache, auth)
- `GET /health/quick` - Simple OK/ERROR for load balancers
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/cache` - Redis cache service status
- `GET /metrics` - System performance metrics

### 🔐 **Admin Endpoints** (Firebase Auth Required)
- `GET /api/parameters` - Get all parameters with query filters
- `GET /api/parameters/:id` - Get single parameter by ID
- `POST /api/parameters` - Create new parameter
- `PUT /api/parameters/:id` - Update parameter with conflict detection
- `DELETE /api/parameters/:id` - Delete parameter (with safety checks)

### 📱 **Client Endpoints** (API Key Required)
- `GET /api/client-config?country=US` - Get optimized client configuration

## 🛠️ Local Development

### Prerequisites
- **Node.js 18+** 
- **Redis Server** (installed automatically via setup)
- **Firebase Project** with Admin SDK
- **npm or yarn**

### Quick Setup
```bash
# 1. Clone and install
git clone <repository-url>
cd acme-configuration-manager-api
npm install

# 2. Setup environment
cp env.example .env
# Edit .env with your Firebase credentials and API keys

# 3. Install and start Redis (macOS)
brew install redis
brew services start redis

# 4. Start development server
npm run dev
```

### Environment Variables
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
# ... other Firebase config

# Security
MOBILE_API_KEY=your-secret-api-key-minimum-32-characters-long
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com

# Redis Caching
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Production Deployment

### Render.com with Redis (Recommended)

Your `render.yaml` includes Redis service configuration:

```yaml
services:
  # Redis Service
  - type: redis
    name: acme-config-redis
    region: oregon
    plan: starter # $7/month
    
  # Web Service
  - type: web
    name: acme-config-api
    # ... automatic Redis connection
```

**Deployment Steps:**
1. Update `render.yaml` with your credentials
2. Push to GitHub/GitLab
3. Create Blueprint service in Render dashboard
4. Redis will be automatically provisioned and connected

### Alternative Redis Options

#### Free Tier Options:
- **Redis Cloud** - Free tier available
- **Upstash Redis** - 10k commands/day free
- **Local Development** - Redis installed locally

#### Without Redis:
The application gracefully falls back to database-only mode if Redis is unavailable.

## 🔐 Authentication & Security

### Firebase Authentication (Admin Operations)
```bash
curl -H "Authorization: Bearer <firebase-token>" \
     -H "Content-Type: application/json" \
     https://your-api.onrender.com/api/parameters
```

### API Key Authentication (Client Access)
```bash
curl -H "x-api-key: your-api-key" \
     https://your-api.onrender.com/api/client-config?country=US
```

### Rate Limiting Tiers
- **General API**: 100 requests/15 minutes
- **Admin Operations**: 50 requests/15 minutes  
- **Client Config**: 30 requests/minute
- **Sensitive Operations**: 10 requests/hour

## 📊 Parameter Structure

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
```javascript
// Specific error types with proper HTTP status codes
ParameterNotFoundError     // 404
ValidationError           // 400  
DatabaseError            // 500
ConflictError            // 409
AuthenticationError      // 401
RateLimitError          // 429
```

### Health Check Response
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "healthy", "latency": 45 },
    "cache": { "status": "healthy", "keyCount": 156 },
    "authentication": { "status": "healthy" }
  },
  "metrics": {
    "memory": { "used": 58011976, "percentage": 91 },
    "process": { "uptime": 3600 }
  }
}
```

## 🔄 Advanced Features

### Conflict Detection & Resolution
```javascript
// Optimistic locking with detailed conflict information
PUT /api/parameters/123
{
  "lastKnownVersion": 5,
  "key": "feature_flag",
  "value": false
}

// Conflict Response (409)
{
  "error": "Conflict",
  "conflictDetails": {
    "currentVersion": 7,
    "providedVersion": 5,
    "lastModifiedBy": "another.admin@company.com",
    "conflictingFields": ["value", "overrides.country.US"]
  },
  "resolutionOptions": {
    "forceUpdate": "Override changes (set forceUpdate: true)",
    "fetchLatest": "Get latest version and retry"
  }
}
```

### Caching Strategy
```javascript
// Automatic cache-aside pattern
const config = await cacheService.getOrSet(
  `client-config:${country}`,
  () => fetchConfigFromDatabase(country),
  300 // 5 minute TTL
);

// Cache invalidation on updates
await cacheService.invalidatePattern('client-config:*');
```

### Request Performance Monitoring
```javascript
// Automatic slow request detection
app.use(performanceLoggingMiddleware(2000)); // Log requests > 2s

// Request correlation for debugging
X-Correlation-ID: uuid-for-request-tracking
```

## 🏗️ Architecture

```
src/
├── config/              # Firebase and database configuration
├── controllers/         # Request handlers with error handling
├── middleware/          # Auth, validation, rate limiting, logging
│   ├── auth.ts         # Firebase and API key authentication
│   ├── validation.ts   # Deep input validation and security
│   ├── rateLimiting.ts # Multi-tier rate limiting
│   └── requestLogging.ts # Performance and audit logging
├── services/            # Business logic services
│   ├── cacheService.ts # Redis caching with fallbacks
│   └── healthService.ts # System health monitoring
├── routes/              # API route definitions
│   ├── configRoutes.ts # Parameter management endpoints
│   └── healthRoutes.ts # Health and monitoring endpoints
├── types/               # TypeScript definitions and custom errors
├── utils/               # Helper functions and utilities
│   ├── configHelpers.ts # Parameter processing functions
│   ├── logger.ts       # Structured logging
│   └── userUtils.ts    # User management utilities
└── index.ts            # Application bootstrap
```

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
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run test         # Run test suite (when implemented)
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