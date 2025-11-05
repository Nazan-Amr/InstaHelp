# API Examples

This document provides curl examples and Postman collection information for testing the InstaHelp API.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-backend-url.com`

## Authentication

Most endpoints require a JWT access token in the Authorization header:

```bash
Authorization: Bearer <access_token>
```

## Example Requests

### 1. Request OTP

```bash
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@instahelp.example.com"
  }'
```

### 2. Verify OTP

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@instahelp.example.com",
    "otp": "123456"
  }'
```

### 3. Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "role": "owner"
  }'
```

### 4. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "owner@instahelp.example.com",
    "password": "Owner123!"
  }'
```

Response:
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "owner@instahelp.example.com",
    "role": "owner"
  },
  "accessToken": "jwt_token_here"
}
```

### 5. Get Current User

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### 6. Get Patient Profile

```bash
curl -X GET http://localhost:3000/api/patients/me \
  -H "Authorization: Bearer <access_token>"
```

### 7. Get QR Token

```bash
curl -X GET http://localhost:3000/api/tokens \
  -H "Authorization: Bearer <access_token>"
```

### 8. Rotate QR Token

```bash
curl -X POST http://localhost:3000/api/tokens/rotate \
  -H "Authorization: Bearer <access_token>"
```

### 9. Get Emergency View (Public)

```bash
curl -X GET http://localhost:3000/r/<token>
```

No authentication required.

### 10. Create Pending Change

```bash
curl -X POST http://localhost:3000/api/patients/pending-changes \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-uuid",
    "changeType": "public_view",
    "fieldPath": "public_view.blood_type",
    "newValue": "A+"
  }'
```

### 11. Approve Pending Change

```bash
curl -X POST http://localhost:3000/api/pending-changes/<change-id>/approve \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Approved by doctor"
  }'
```

### 12. Reject Pending Change

```bash
curl -X POST http://localhost:3000/api/pending-changes/<change-id>/reject \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Incorrect information"
  }'
```

### 13. Get Pending Changes

```bash
curl -X GET http://localhost:3000/api/pending-changes \
  -H "Authorization: Bearer <access_token>"
```

### 14. Device Vitals Ingestion

```bash
# First, generate HMAC signature (example in Node.js)
# const crypto = require('crypto');
# const payload = { device_id: "ESP32-001", timestamp: "...", hr: 75, temp: 37.2 };
# const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
# const signature = crypto.createHmac('sha256', 'device-secret').update(payloadString).digest('hex');

curl -X POST http://localhost:3000/api/v1/devices/ESP32-DEVICE-001/vitals \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP32-DEVICE-001",
    "timestamp": "2024-01-01T12:00:00Z",
    "hr": 75,
    "temp": 37.2,
    "signature": "hmac_signature_here"
  }'
```

### 15. Admin: Get Unverified Doctors

```bash
curl -X GET http://localhost:3000/api/admin/doctors/unverified \
  -H "Authorization: Bearer <admin_access_token>"
```

### 16. Admin: Verify Doctor

```bash
curl -X POST http://localhost:3000/api/admin/doctors/<doctor-id>/verify \
  -H "Authorization: Bearer <admin_access_token>"
```

### 17. Admin: Get Audit Logs

```bash
curl -X GET "http://localhost:3000/api/admin/audit-logs?limit=50&offset=0" \
  -H "Authorization: Bearer <admin_access_token>"
```

## Postman Collection

A Postman collection is available in the repository. Import it into Postman:

1. Open Postman
2. Click Import
3. Select the file or paste the collection JSON
4. Set environment variables:
   - `base_url`: `http://localhost:3000`
   - `access_token`: (will be set after login)

## Testing Workflow

1. **Register a new user** (requires OTP verification)
2. **Login** to get access token
3. **Create patient profile** (if owner)
4. **Generate QR token** (if owner)
5. **Test emergency view** using the token
6. **Create pending change** (requires approvals)
7. **Approve/reject changes** (as doctor or owner)
8. **View audit logs** (as admin)

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

Common status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- OTP endpoints: 3 requests per minute
- Device endpoints: 1 request per minute

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

