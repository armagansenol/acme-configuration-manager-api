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

## 🚀 Render.com Deployment

### Prerequisites
- A Render.com account
- Your code pushed to a GitHub/GitLab repository

### Deployment Methods

You can deploy to Render in two ways:

#### Method 1: Using the Render Dashboard (Recommended for Beginners)

1.  **Create a New Web Service**:
    *   Go to the [Render Dashboard](https://dashboard.render.com/) and click "New" > "Web Service".
    *   Connect your GitHub or GitLab account and select your repository.

2.  **Configure the Service**:
    *   **Name**: Give your service a name (e.g., `acme-config-api`).
    *   **Region**: Choose a region close to you.
    *   **Runtime**: Render will detect `Node`.
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Plan**: Choose the 'Free' plan to start.

3.  **Add Environment Variables**:
    *   Under the "Environment" section, click "Add Environment Variable" or "Add Secret File" for each of the following. Use "Secret File" for long or sensitive values like `FIREBASE_PRIVATE_KEY`.
    *   **Key**: `NODE_ENV`, **Value**: `production`
    *   **Key**: `PORT`, **Value**: `10000` (Render's default)
    *   **Key**: `FIREBASE_PROJECT_ID`, **Value**: `your-project-id`
    *   **Key**: `FIREBASE_PRIVATE_KEY_ID`, **Value**: `your-private-key-id`
    *   **Key**: `FIREBASE_PRIVATE_KEY`, **Value**: (your full private key)
    *   **Key**: `FIREBASE_CLIENT_EMAIL`, **Value**: `your-client-email`
    *   **Key**: `FIREBASE_CLIENT_ID`, **Value**: `your-client-id`
    *   **Key**: `MOBILE_API_KEY`, **Value**: `your-secret-key`
    *   **Key**: `ALLOWED_ORIGINS`, **Value**: `https://your-frontend.com`

4.  **Deploy**:
    *   Click "Create Web Service". Render will automatically build and deploy your application. Auto-deploys on pushes to your main branch will be enabled by default.

#### Method 2: Infrastructure as Code with `render.yaml`

1.  **Update the `render.yaml` file**:
    The `render.yaml` file is already included in your repository with placeholder values. Before deploying, you need to replace the placeholder values with your actual credentials:
    
    *   Replace `your-project-id` with your Firebase project ID
    *   Replace `your-private-key-id` with your Firebase private key ID
    *   Replace `YOUR_PRIVATE_KEY_HERE` with your actual Firebase private key (keep the `-----BEGIN PRIVATE KEY-----` wrapper)
    *   Replace `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com` with your Firebase client email
    *   Replace `your-client-id` with your Firebase client ID
    *   Replace `your-secret-mobile-api-key-minimum-32-characters-long` with your API key
    *   Replace `https://your-frontend-domain.com` with your frontend domain

2.  **Create a New "Blueprint" Service**:
    *   Go to the [Render Dashboard](https://dashboard.render.com/) and click "New" > "Blueprint".
    *   Select your repository. Render will automatically detect and use the `render.yaml` file.
    *   Review the configuration and click "Apply" to deploy.

**Security Note**: The `render.yaml` method puts your credentials directly in the file. For better security, consider using Method 1 (Dashboard) where you can add sensitive values as environment variables through the UI.

## 🔐 Authentication

### Firebase Authentication (Admin Operations)
```bash
curl -H "Authorization: Bearer <firebase-token>" \
     https://acme-config-api.onrender.com/api/parameters
```

### API Key Authentication (Client Access)
```bash
curl -H "x-api-key: your-api-key" \
     https://acme-config-api.onrender.com/api/client-config?country=US
```

## 📊 Parameter Structure

```json
{
  "id": "feature_flag_1",
  "key": "enable_new_feature",
  "value": true,
  "type": "boolean",
  "description": "Enable the new feature for users",
  "overrides": {
    "country": {
      "US": "value1",
      "FR": "value2"
    }
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
✅ **Cloud Ready**: Optimized for Render.com deployment  

## 📄 License

MIT License - see LICENSE file for details. 