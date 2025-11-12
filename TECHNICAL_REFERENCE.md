# Technical Reference - QR & Vital Features

## Backend Architecture

### Type Definitions
**File:** `backend/src/types/index.ts`

```typescript
// New interfaces for extended medical information
interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  reason: string;
  start_date?: string;
}

interface Allergy {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  reaction: string;
}

interface Surgery {
  name: string;
  date: string;
  surgeon?: string;
  hospital?: string;
  complications?: string;
}

interface ChronicCondition {
  condition: string;
  diagnosed_date: string;
  status: 'active' | 'controlled' | 'resolved';
  treatment: string;
}

interface Immunization {
  vaccine: string;
  date: string;
  dose?: string;
  booster_due?: string;
}

interface VitalRange {
  heart_rate_min: number;
  heart_rate_max: number;
  temperature_min: number;
  temperature_max: number;
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
}
```

### Database Schema
**File:** `backend/supabase/migrations/003_extend_patient_medical_info.sql`

#### Patient Table Extensions
```sql
ALTER TABLE patients 
ADD COLUMN rh_factor TEXT CHECK (rh_factor IN ('+', '-')) DEFAULT '+';
ADD COLUMN vital_ranges JSONB DEFAULT '{
  "heart_rate_min": 60,
  "heart_rate_max": 100,
  "temperature_min": 36.1,
  "temperature_max": 37.2,
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80
}'::jsonb;
```

#### New Tables
```sql
-- Chronic Conditions
CREATE TABLE chronic_conditions (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  diagnosed_date DATE NOT NULL,
  status TEXT CHECK (status IN ('active', 'controlled', 'resolved')),
  treatment TEXT NOT NULL,
  UNIQUE(patient_id, condition)
);

-- Surgeries
CREATE TABLE surgeries (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  surgeon TEXT,
  hospital TEXT,
  complications TEXT
);

-- Medications
CREATE TABLE medications (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  reason TEXT NOT NULL,
  start_date DATE
);

-- Immunizations
CREATE TABLE immunizations (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  vaccine TEXT NOT NULL,
  date DATE NOT NULL,
  dose TEXT,
  booster_due DATE
);

-- Allergies
CREATE TABLE allergies (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  reaction TEXT NOT NULL,
  UNIQUE(patient_id, allergen)
);
```

### Emergency Controller
**File:** `backend/src/controllers/emergency.controller.ts`

#### Endpoint: GET /r/:token
- **Public Access**: Returns emergency summary
- **With Auth**: Returns full medical data if user is authorized
- **Query Params**: `?full=true` to request full data
- **Headers**: `Authorization: Bearer <jwt_token>`

#### Response Structure
```typescript
{
  public_view: {
    blood_type: string;
    rh_factor: '+' | '-';
    allergies: Allergy[];
    emergency_contact: object;
    short_instructions: string;
    vital_ranges: VitalRange;
    last_vitals?: {
      timestamp: string;
      heart_rate?: number;
      temperature?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      oxygen_saturation?: number;
      respiratory_rate?: number;
    };
  };
  full_data?: {
    patient_id: string;
    private_profile: object;
    chronic_conditions: ChronicCondition[];
    surgeries: Surgery[];
    medications: Medication[];
    immunizations: Immunization[];
  };
  is_authenticated: boolean;
}
```

#### Access Control Logic
```
1. Check if token is valid and not revoked
2. If full=true and auth token provided:
   a. Verify JWT
   b. Get user role
   c. Check if user is:
      - Patient owner → Allow
      - Doctor (verified) → Allow
      - Admin → Allow
   d. Return full_data if authorized
3. Always return public_view
4. Log access attempt with user role and IP
```

---

## Frontend Architecture

### Vital Monitor Component
**File:** `frontend/src/components/VitalMonitor.tsx`

#### Props
```typescript
interface VitalReading {
  value: number;
  unit: string;
  normal_min?: number;
  normal_max?: number;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
}

interface VitalMonitorProps {
  heartRate?: VitalReading;
  temperature?: VitalReading;
  bloodPressureSystolic?: VitalReading;
  bloodPressureDiastolic?: VitalReading;
  oxygenSaturation?: VitalReading;
  respiratoryRate?: VitalReading;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}
```

#### State Management
```typescript
const [isCollapsed, setIsCollapsed] = useState(collapsed);
const [animatingVitals, setAnimatingVitals] = useState<Set<string>>(new Set());
```

#### Key Features
- **Fixed Positioning**: `fixed bottom-4 right-4 z-40`
- **Collapsible**: Click header to toggle
- **Responsive**: Adapts to mobile screens
- **Status Indicators**: Color-coded by health status
- **Animated Alerts**: Pulse animation for critical vitals

#### CSS Classes Used
- TailwindCSS utility classes
- Gradient backgrounds
- Responsive grid layouts
- Hover and transition effects

### Emergency Page
**File:** `frontend/src/pages/EmergencyPage.tsx`

#### Component States
```typescript
const [data, setData] = useState<EmergencyView | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
const [hospitals, setHospitals] = useState<any[]>([]);
```

#### Data Flow
```
1. Get token from URL params
2. Get auth token from session (if logged in)
3. Call emergencyAPI.getEmergencyView(token, authToken)
4. Response includes public_view + optional full_data
5. If has last_vitals: Create VitalReading objects
6. Render UI based on data availability
```

#### Vital Data Mapping
```typescript
const vitalData = {
  heartRate: {
    value: public_view.last_vitals.heart_rate,
    unit: 'bpm',
    normal_min: public_view.vital_ranges?.heart_rate_min || 60,
    normal_max: public_view.vital_ranges?.heart_rate_max || 100,
    timestamp: public_view.last_vitals.timestamp,
    status: calculateStatus(value, min, max)
  }
  // ... similar for other vitals
};
```

#### Status Calculation
```typescript
function calculateStatus(value: number, min?: number, max?: number): 'normal' | 'warning' | 'critical' {
  if (!min || !max) return 'normal';
  
  const isOutOfRange = value < min || value > max;
  const isSignificantlyOff = value < min * 0.9 || value > max * 1.1;
  
  return isSignificantlyOff ? 'critical' : isOutOfRange ? 'warning' : 'normal';
}
```

### Emergency API
**File:** `frontend/src/api/emergency.api.ts`

#### API Call
```typescript
export const emergencyAPI = {
  getEmergencyView: async (token: string, authToken?: string): Promise<EmergencyView> => {
    const params = authToken ? { full: 'true' } : {};
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    
    const response = await axios.get(`${API_URL}/r/${token}`, {
      params,
      headers,
    });
    return response.data;
  },
};
```

#### Error Handling
```typescript
try {
  const response = await emergencyAPI.getEmergencyView(token, authToken);
  // Process response
} catch (err: any) {
  setError(err.response?.data?.error || err.message || 'Failed to load emergency data');
}
```

---

## Data Flow Diagrams

### Public Emergency Access Flow
```
Patient QR Code
        ↓
   Token String
        ↓
GET /r/:token (no auth)
        ↓
Check Token Validity
        ↓
Retrieve public_view only
        ↓
Log Anonymous Access
        ↓
Return EmergencyView {
  public_view: {...},
  full_data: null,
  is_authenticated: false
}
        ↓
Display Emergency Summary + Vital Monitor
```

### Authenticated Access Flow
```
Logged-in User scans QR
        ↓
Token String + JWT Token
        ↓
GET /r/:token?full=true
Authorization: Bearer <jwt>
        ↓
Check Token Validity
        ↓
Verify JWT & Get User Role
        ↓
Check Authorization:
├─ Owner? Yes → Return full_data
├─ Doctor? Yes → Return full_data
├─ Admin? Yes → Return full_data
└─ Other? No → full_data = null
        ↓
Log Access with User Role
        ↓
Return EmergencyView {
  public_view: {...},
  full_data: {...} (if authorized),
  is_authenticated: true (if has full_data)
}
        ↓
Display Full Medical Information
```

---

## Integration Points

### Frontend to Backend
- Emergency Page → Emergency Controller
- Emergency API → Backend API
- VitalMonitor → EmergencyPage → Backend Data

### Database to Backend
- Emergency Controller → Token Service
- Emergency Controller → Patient Service
- Emergency Controller → Audit Service
- Patient Service → Database Tables

### Frontend Components
- EmergencyPage → VitalMonitor (prop passing)
- EmergencyPage → emergencyAPI (data fetching)
- VitalMonitor → Self-contained UI rendering

---

## Security Considerations

### Token Management
- Tokens are revokable
- Each token tied to specific patient
- Timestamp tracking for access auditing
- IP logging for suspicious access

### Role-Based Access Control (RBAC)
- Owner: Access own data only
- Doctor: Access any patient data
- Admin: Access any patient data
- Public/Rescuer: Emergency data only

### Data Encryption
- Private profile encrypted in database
- Encryption key wrapped with RSA
- Only decrypted on authorized access
- All access logged for audit trail

### Frontend Security
- JWT tokens in session storage
- Auth header for all authenticated requests
- CORS restrictions
- XSS prevention via React escaping

---

## Performance Optimization

### Database Queries
- Indexes on patient_id for all medical tables
- Single query for public_view
- Separate queries for full_data (lazy loaded)
- Connection pooling via Supabase

### Frontend Caching
- Emergency data cached in state
- Hospital data fetched once
- Location data cached until page close
- Vital Monitor data updates only on new props

### UI Rendering
- VitalMonitor uses React.memo for optimization
- Conditional rendering for missing data
- Lazy loading of hospital map
- Responsive grid prevents layout thrashing

---

## Testing Strategy

### Unit Tests
- VitalMonitor component with various vital combinations
- Status calculation logic with edge cases
- API response parsing and error handling

### Integration Tests
- Full emergency access flow (public)
- Full emergency access flow (authenticated doctor)
- Full emergency access flow (owner)
- Denied access scenarios

### End-to-End Tests
- QR code scan to data display
- Vital monitor interaction (collapse/expand)
- Emergency contact call button
- Hospital navigation

### Security Tests
- Token revocation enforcement
- Unauthorized access blocking
- SQL injection prevention
- XSS vulnerability checks

---

## Deployment Checklist

- [ ] Run database migrations
- [ ] Update backend environment variables
- [ ] Deploy backend changes
- [ ] Build frontend with new components
- [ ] Deploy frontend changes
- [ ] Run smoke tests on emergency pages
- [ ] Verify QR code generation/scanning
- [ ] Check vital monitor display
- [ ] Audit logging verification
- [ ] Security review complete

---

## Troubleshooting Guide

### Issue: Vital Monitor not rendering
**Solution:**
- Check if patient has `last_vitals` data
- Verify `public_view.vital_ranges` exists
- Check browser console for errors

### Issue: Full data not accessible when logged in
**Solution:**
- Verify user JWT is valid
- Check user role in database
- Confirm patient-doctor relationship exists
- Check audit logs for access denial reason

### Issue: Allergies showing as empty
**Solution:**
- Verify allergies are added to patient profile
- Check severity level is set
- Ensure reaction description is filled
- Check database allergies table

### Issue: Blood pressure displaying as 0/0
**Solution:**
- Patient may not have BP readings
- Verify `last_vitals.blood_pressure_*` exists
- Check vital ranges configuration
- Wait for new data from device

---

## API Rate Limiting

- Emergency endpoint: No specific limit (public access)
- Authenticated endpoints: Standard rate limiting applies
- Hospital Overpass API: Limited by service
- Geolocation: Browser-limited by user permissions

---

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 14+)
- Mobile Browsers: Full support with responsive design

**Required Features:**
- Geolocation API (for hospital finding)
- Fetch API
- ES2020+ JavaScript support
