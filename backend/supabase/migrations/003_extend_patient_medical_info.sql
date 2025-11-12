-- Extend patient table with comprehensive medical information
-- Add RH factor
ALTER TABLE patients ADD COLUMN rh_factor TEXT CHECK (rh_factor IN ('+', '-')) DEFAULT '+';

-- Add vital ranges (stored as JSON for flexibility)
ALTER TABLE patients ADD COLUMN vital_ranges JSONB DEFAULT '{
  "heart_rate_min": 60,
  "heart_rate_max": 100,
  "temperature_min": 36.1,
  "temperature_max": 37.2,
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80
}'::jsonb;

-- Extend public_view to include:
-- - allergy severity levels
-- - vital ranges
-- - extended last vitals (blood pressure, O2 saturation, respiratory rate)
-- This is managed via application code since public_view is JSONB

-- Create separate tables for detailed medical information for easier querying and updates

-- Chronic Conditions table
CREATE TABLE IF NOT EXISTS chronic_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  diagnosed_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'controlled', 'resolved')),
  treatment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, condition)
);

-- Surgeries table
CREATE TABLE IF NOT EXISTS surgeries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  surgeon TEXT,
  hospital TEXT,
  complications TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications table
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  reason TEXT NOT NULL,
  start_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Immunizations table
CREATE TABLE IF NOT EXISTS immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine TEXT NOT NULL,
  date DATE NOT NULL,
  dose TEXT,
  booster_due DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Allergies table (replaces simple string array)
CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  reaction TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, allergen)
);

-- Add indexes for better query performance
CREATE INDEX idx_chronic_conditions_patient ON chronic_conditions(patient_id);
CREATE INDEX idx_surgeries_patient ON surgeries(patient_id);
CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX idx_allergies_patient ON allergies(patient_id);

-- Add trigger to update 'updated_at' for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chronic_conditions_updated_at BEFORE UPDATE ON chronic_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surgeries_updated_at BEFORE UPDATE ON surgeries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_immunizations_updated_at BEFORE UPDATE ON immunizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allergies_updated_at BEFORE UPDATE ON allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
