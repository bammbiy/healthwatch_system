-- HealthWatch Pro Database Schema

-- Create database
CREATE DATABASE healthwatch;

-- Use the database
\c healthwatch;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (medical staff)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('doctor', 'nurse', 'admin', 'technician')) NOT NULL,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    medical_record_number VARCHAR(50) UNIQUE NOT NULL,
    contact_number VARCHAR(20),
    emergency_contact VARCHAR(20),
    emergency_contact_name VARCHAR(100),
    room_number VARCHAR(10),
    bed_number VARCHAR(10),
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'discharged', 'transferred')) DEFAULT 'active',
    admission_date DATE NOT NULL,
    discharge_date DATE,
    attending_doctor_id INTEGER REFERENCES users(id),
    primary_nurse_id INTEGER REFERENCES users(id),
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vital signs table
CREATE TABLE vital_signs (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    heart_rate INTEGER CHECK (heart_rate >= 0 AND heart_rate <= 300),
    blood_pressure_systolic INTEGER CHECK (blood_pressure_systolic >= 0 AND blood_pressure_systolic <= 300),
    blood_pressure_diastolic INTEGER CHECK (blood_pressure_diastolic >= 0 AND blood_pressure_diastolic <= 200),
    temperature DECIMAL(4,2) CHECK (temperature >= 30.0 AND temperature <= 45.0),
    oxygen_saturation INTEGER CHECK (oxygen_saturation >= 0 AND oxygen_saturation <= 100),
    respiratory_rate INTEGER CHECK (respiratory_rate >= 0 AND respiratory_rate <= 60),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_by INTEGER REFERENCES users(id),
    device_id VARCHAR(50), -- for automatic readings from medical devices
    notes TEXT,
    is_manual BOOLEAN DEFAULT true -- true if manually entered, false if from device
);

-- Medical alerts table
CREATE TABLE medical_alerts (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'heart_rate', 'temperature', 'blood_pressure', etc.
    alert_level VARCHAR(20) CHECK (alert_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    message TEXT NOT NULL,
    vital_sign_id INTEGER REFERENCES vital_signs(id),
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical records table
CREATE TABLE medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    record_type VARCHAR(50) NOT NULL, -- 'diagnosis', 'treatment', 'lab_result', 'imaging'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url VARCHAR(500), -- S3 URL for uploaded files
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications table
CREATE TABLE medications (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    prescribed_by INTEGER REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('active', 'completed', 'discontinued')) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medication administration log
CREATE TABLE medication_logs (
    id SERIAL PRIMARY KEY,
    medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    administered_by INTEGER REFERENCES users(id),
    administered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dosage_given VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) CHECK (status IN ('given', 'refused', 'missed')) DEFAULT 'given'
);

-- Audit log for all database changes
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET
);

-- Sessions table for user authentication
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_admission_date ON patients(admission_date);
CREATE INDEX idx_patients_medical_record ON patients(medical_record_number);
CREATE INDEX idx_patients_room ON patients(room_number);

CREATE INDEX idx_vital_signs_patient_time ON vital_signs(patient_id, recorded_at DESC);
CREATE INDEX idx_vital_signs_recorded_at ON vital_signs(recorded_at DESC);
CREATE INDEX idx_vital_signs_heart_rate ON vital_signs(heart_rate) WHERE heart_rate IS NOT NULL;
CREATE INDEX idx_vital_signs_temperature ON vital_signs(temperature) WHERE temperature IS NOT NULL;

CREATE INDEX idx_medical_alerts_patient ON medical_alerts(patient_id);
CREATE INDEX idx_medical_alerts_unacknowledged ON medical_alerts(is_acknowledged) WHERE is_acknowledged = false;
CREATE INDEX idx_medical_alerts_created_at ON medical_alerts(created_at DESC);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);

CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_status ON medications(status);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for automatic alert generation
CREATE OR REPLACE FUNCTION check_vital_signs_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Heart rate alerts
    IF NEW.heart_rate IS NOT NULL THEN
        IF NEW.heart_rate > 120 OR NEW.heart_rate < 50 THEN
            INSERT INTO medical_alerts (patient_id, alert_type, alert_level, message, vital_sign_id)
            VALUES (
                NEW.patient_id,
                'heart_rate',
                CASE 
                    WHEN NEW.heart_rate > 150 OR NEW.heart_rate < 40 THEN 'critical'
                    WHEN NEW.heart_rate > 120 OR NEW.heart_rate < 50 THEN 'high'
                    ELSE 'medium'
                END,
                CASE 
                    WHEN NEW.heart_rate > 120 THEN 'High heart rate detected: ' || NEW.heart_rate || ' BPM'
                    ELSE 'Low heart rate detected: ' || NEW.heart_rate || ' BPM'
                END,
                NEW.id
            );
        END IF;
    END IF;

    -- Temperature alerts
    IF NEW.temperature IS NOT NULL THEN
        IF NEW.temperature > 38.0 OR NEW.temperature < 35.5 THEN
            INSERT INTO medical_alerts (patient_id, alert_type, alert_level, message, vital_sign_id)
            VALUES (
                NEW.patient_id,
                'temperature',
                CASE 
                    WHEN NEW.temperature > 39.5 OR NEW.temperature < 35.0 THEN 'critical'
                    WHEN NEW.temperature > 38.0 OR NEW.temperature < 35.5 THEN 'high'
                    ELSE 'medium'
                END,
                'Temperature alert: ' || NEW.temperature || '°C',
                NEW.id
            );
        END IF;
    END IF;

    -- Blood pressure alerts
    IF NEW.blood_pressure_systolic IS NOT NULL THEN
        IF NEW.blood_pressure_