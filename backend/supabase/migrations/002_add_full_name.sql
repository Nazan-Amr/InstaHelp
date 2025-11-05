-- Add full_name column to users table for storing doctor names
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

