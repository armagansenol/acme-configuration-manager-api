# ACME Configuration Manager API

A robust, production-ready configuration management API for dynamic application parameters with country-specific overrides.

## 🚀 Features

- **Firebase Authentication** - Secure admin operations
- **API Key Authentication** - Mobile client access
- **Country-specific Overrides** - Localized configuration
- **Rate Limiting** - 100 requests per 15 minutes
- **Comprehensive Logging** - Security events and audit trails
- **Input Validation** - Joi schema validation
- **TypeScript** - Full type safety
- **Production Security** - Helmet, CORS, sanitized logging

## 📡 API Endpoints

### Public Endpoints
- `GET /` - API documentation
- `GET /health` - Health check

### Admin Endpoints (Firebase Auth Required)
- `GET /api/parameters` - Get all parameters
- `POST /api/parameters` - Create parameter
- `PUT /api/parameters/:id` - Update parameter
- `DELETE /api/parameters/:id` - Delete parameter

### Client Endpoints (API Key Required)
- `GET /api/client-config?country=US` - Get client configuration

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- Firebase project with Admin SDK
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp env.example .env
   ```

4. Configure your `.env` file with:
   - Firebase Admin SDK credentials
   - API keys
   - CORS origins

5. Start development server:
   ```bash
   npm run dev
   ```

## 🚀 Vercel Deployment

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/acme-configuration-manager-api)

### Manual Deployment

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### Environment Variables in Vercel

Configure these environment variables in your Vercel dashboard:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com

# API Security
MOBILE_API_KEY=your-secret-mobile-api-key-minimum-32-characters-long

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://your-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔐 Authentication

### Firebase Authentication (Admin Operations)
```bash
curl -H "Authorization: Bearer <firebase-token>" \
     https://your-api.vercel.app/api/parameters
```

### API Key Authentication (Client Access)
```bash
curl -H "x-api-key: your-api-key" \
     https://your-api.vercel.app/api/client-config?country=US
```

## 📊 Parameter Structure

```json
{
  "id": "feature_flag_1",
  "key": "enable_new_feature",
  "value": true,
  "type": "boolean",
  "description": "Enable the new feature for users",
  "countryOverrides": {
    "US": true,
    "EU": false
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **Input Validation** - Joi schema validation
- **Constant-time Comparison** - API key validation
- **Sanitized Logging** - No sensitive data in logs
- **Security Event Tracking** - Audit trails
- **Environment-aware Errors** - No stack traces in production

## 📝 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run clean` - Clean build directory

## 🏗️ Architecture

```
src/
├── config/          # Firebase and database configuration
├── controllers/     # Request handlers
├── middleware/      # Authentication and validation
├── routes/          # API route definitions
├── types/           # TypeScript type definitions
├── utils/           # Utility functions and logging
└── index.ts         # Application entry point
```

## 📈 Production Readiness

✅ **Security**: Comprehensive authentication and authorization  
✅ **Logging**: Structured logging with Winston  
✅ **Validation**: Input validation with Joi schemas  
✅ **Error Handling**: Graceful error responses  
✅ **Rate Limiting**: Protection against abuse  
✅ **CORS**: Configurable cross-origin policies  
✅ **TypeScript**: Full type safety  
✅ **Serverless Ready**: Optimized for Vercel deployment  

## 📄 License

MIT License - see LICENSE file for details. 