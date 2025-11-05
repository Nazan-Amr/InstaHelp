# InstaHelp - Emergency Medical Data System

A secure, production-ready emergency medical data system that connects wearable QR rings and sensor bands to a cloud-hosted platform. InstaHelp provides instant access to critical medical information for emergency responders while maintaining strict privacy and security controls.

## 🎯 Project Overview

InstaHelp is designed for ISEF biomedical engineering projects and potential real-world deployment. It enables:

- **QR Code Emergency Access**: Rescuers can scan a QR code to instantly view critical medical information
- **Dual-Approval Workflow**: All medical record edits require approval from multiple parties (owner + doctors)
- **Real-time Vitals**: ESP32 device integration for live vital signs monitoring
- **Role-Based Access**: Separate dashboards for owners (patients), doctors, rescuers, and administrators
- **End-to-End Encryption**: AES-256-GCM encryption with RSA-2048 key wrapping for sensitive data

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Leaflet.js + OpenStreetMap for hospital mapping

**Backend:**
- Node.js + Express with TypeScript
- Supabase (PostgreSQL) for database
- Supabase Storage for encrypted file storage
- JWT authentication with refresh tokens
- Custom encryption service (AES-256-GCM + RSA-2048)

**Infrastructure:**
- Docker and Docker Compose for containerization
- GitHub Actions for CI/CD
- Netlify for frontend hosting (ready)
- Supabase for database and storage

## 📋 Prerequisites

- Node.js 20+
- npm or yarn
- Docker and Docker Compose (for local development)
- Supabase account (free tier works)
- Git

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd InstaCure
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   ```bash
   backend/supabase/migrations/001_initial_schema.sql
   ```
3. Note your Supabase URL, Service Role Key, and Anon Key

### 3. Generate RSA Keys

Generate RSA-2048 keys for encryption:

```bash
cd backend
mkdir -p keys
openssl genrsa -out keys/private_key.pem 2048
openssl rsa -in keys/private_key.pem -pubout -out keys/public_key.pem
```

### 4. Configure Backend

1. Copy `.env.example` to `.env` in the `backend` directory
2. Fill in your Supabase credentials and other environment variables:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
JWT_SECRET=generate_a_secure_random_string_min_32_chars
JWT_REFRESH_SECRET=generate_another_secure_random_string
DEVICE_HMAC_SECRET=generate_device_hmac_secret
AES_MASTER_KEY=generate_32_byte_hex_key
```

Generate secrets:
```bash
# JWT secrets (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# AES master key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Configure Email (Optional for Development)

For development, use Mailtrap:
1. Sign up at [mailtrap.io](https://mailtrap.io)
2. Copy SMTP credentials to `.env`

For production, use SendGrid or SMTP:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

### 6. Install and Run Backend

```bash
cd backend
npm install
npm run dev
```

Backend will run on `http://localhost:3000`

### 7. Install and Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

### 8. Seed Database

In a new terminal:

```bash
cd backend
npm run seed
```

This creates sample users:
- **Admin**: admin@instahelp.example.com / Admin123!
- **Owner**: owner@instahelp.example.com / Owner123!
- **Doctor**: doctor@instahelp.example.com / Doctor123!

## 📁 Project Structure

```
InstaCure/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (database, env)
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilities (logger, token generator)
│   │   ├── scripts/         # Seed and simulation scripts
│   │   └── tests/           # Test files
│   ├── supabase/
│   │   └── migrations/       # Database migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # API client and endpoints
│   │   ├── context/         # React context (Auth)
│   │   ├── pages/           # Page components
│   │   └── App.tsx          # Main app component
│   └── package.json
└── README.md
```

## 🔐 Security Features

### Encryption

- **AES-256-GCM**: Used for encrypting patient private profiles and uploaded files
- **RSA-2048**: Used for wrapping/unwrapping AES keys (KEK pattern)
- Each patient has a unique AES key, stored encrypted with the RSA public key

### Authentication

- **JWT Access Tokens**: Short-lived (15 minutes default)
- **Refresh Tokens**: Long-lived (7 days), stored in HTTP-only cookies
- **OTP Email Flow**: Two-factor authentication via email

### Access Control

- **Role-Based Access Control (RBAC)**: Owner, Doctor, Admin, Rescuer (anonymous)
- **Rate Limiting**: Applied to OTP endpoints and device ingestion
- **Audit Logging**: All actions are logged immutably

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:coverage
```

### Security Testing

Test token brute-force resistance:

```bash
cd backend
node src/scripts/test-token-security.js
```

## 📡 ESP32 Device Integration

### Register a Device

Devices must be registered before they can send vitals:

```bash
# Via API (after authentication)
POST /api/devices/register
{
  "patientId": "patient-uuid",
  "deviceId": "ESP32-DEVICE-001",
  "deviceSecret": "shared-secret-key"
}
```

### Simulate Device Uploads

Use the provided simulation script:

```bash
cd backend
npm run simulate-device
```

Or set environment variables:
```bash
DEVICE_ID=ESP32-DEVICE-001 \
DEVICE_SECRET=device-secret-key-123 \
API_URL=http://localhost:3000 \
npm run simulate-device
```

### Device Payload Format

Devices must send HMAC-signed payloads:

```json
{
  "device_id": "ESP32-DEVICE-001",
  "timestamp": "2024-01-01T12:00:00Z",
  "hr": 75,
  "temp": 37.2,
  "signature": "hmac_sha256_signature"
}
```

Signature is generated from all fields except `signature`, sorted alphabetically.

## 🚢 Deployment

### Frontend (Netlify)

1. Connect your GitHub repository to Netlify
2. Set build command: `cd frontend && npm install && npm run build`
3. Set publish directory: `frontend/dist`
4. Add environment variable: `VITE_API_URL=https://your-backend-url.com`
5. Update `netlify.toml` with your backend URL

### Backend (Heroku/Render/Docker)

#### Option 1: Heroku

```bash
cd backend
heroku create instahelp-backend
heroku config:set SUPABASE_URL=...
heroku config:set JWT_SECRET=...
# ... set all env vars
git push heroku main
```

#### Option 2: Render

1. Create a new Web Service
2. Connect your repository
3. Set build command: `cd backend && npm install && npm run build`
4. Set start command: `cd backend && npm start`
5. Add all environment variables

#### Option 3: Docker

```bash
cd backend
docker build -t instahelp-backend .
docker run -p 3000:3000 --env-file .env instahelp-backend
```

### Database (Supabase)

- Free tier includes 500MB database and 1GB file storage
- For production, consider upgrading to Pro plan
- Enable Row Level Security (RLS) policies as needed

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/request-otp` - Request OTP email
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT tokens
- `GET /api/auth/me` - Get current user

### Patient Endpoints (Authenticated)

- `GET /api/patients/me` - Get own patient profile
- `GET /api/patients/me/public-view` - Get public view
- `POST /api/patients/pending-changes` - Create pending change

### Token Endpoints (Owner Only)

- `GET /api/tokens` - Get current QR token
- `POST /api/tokens/rotate` - Rotate QR token
- `POST /api/tokens/revoke` - Revoke QR token

### Emergency Endpoints (Public)

- `GET /r/:token` - Get emergency view by token

### Pending Changes (Authenticated)

- `GET /api/pending-changes` - List pending changes
- `POST /api/pending-changes/:id/approve` - Approve change
- `POST /api/pending-changes/:id/reject` - Reject change

### Device Endpoints

- `POST /api/v1/devices/:deviceId/vitals` - Ingest vitals (HMAC-signed)

### Admin Endpoints (Admin Only)

- `GET /api/admin/doctors/unverified` - List unverified doctors
- `POST /api/admin/doctors/:id/verify` - Verify doctor
- `GET /api/admin/audit-logs` - Get audit logs

## 🔄 Approval Workflow

All edits to medical records require dual approval:

1. **Owner-initiated changes**: Require approval from 2 verified doctors
2. **Doctor-initiated changes**: Require approval from owner + 1 other doctor

When required approvals are collected, changes are automatically finalized.

## 📝 Environment Variables

See `.env.example` files in both `backend` and `frontend` directories for complete list.

Key variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for backend)
- `JWT_SECRET` - Secret for JWT access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `DEVICE_HMAC_SECRET` - Shared secret for device HMAC signing
- `RSA_PRIVATE_KEY_PATH` - Path to RSA private key
- `RSA_PUBLIC_KEY_PATH` - Path to RSA public key

## 🛠️ Development

### Running Locally

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Access frontend at `http://localhost:5173`
4. API available at `http://localhost:3000`

### Database Migrations

Run migrations in Supabase SQL Editor:
```sql
-- Copy contents of backend/supabase/migrations/001_initial_schema.sql
```

### Linting and Formatting

```bash
# Backend
cd backend
npm run lint
npm run format

# Frontend
cd frontend
npm run lint
npm run format
```

## 🐛 Troubleshooting

### Backend won't start

- Check all environment variables are set
- Verify RSA keys exist at specified paths
- Ensure Supabase credentials are correct

### Frontend can't connect to backend

- Check `VITE_API_URL` is set correctly
- Verify backend is running on correct port
- Check CORS configuration in backend

### Database errors

- Verify Supabase migration has been run
- Check RLS policies if using anon key
- Ensure service role key is used for backend

### Email not sending

- For development, use Mailtrap
- Check email credentials in `.env`
- Verify email service is initialized (check logs)

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is an ISEF project. For contributions, please contact the project maintainers.

## 📧 Support

For issues or questions, please open an issue in the repository.

## 🔮 Future Enhancements

- [ ] TOTP 2FA support (speakeasy)
- [ ] SMS OTP option (Twilio integration)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Integration with hospital systems (HL7 FHIR)

---

**Note**: This system handles real PHI (Protected Health Information). Ensure compliance with HIPAA, GDPR, and local regulations before production deployment.

