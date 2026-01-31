import { Pool } from 'pg';
import { db } from '../config/database';

export interface Patient {
  id?: number;
  name: string;
  dateOfBirth: string;
  medicalRecordNumber: string;
  contactNumber?: string;
  emergencyContact?: string;
  roomNumber?: string;
  status: 'active' | 'inactive' | 'discharged';
  admissionDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VitalSigns {
  id?: number;
  patientId: number;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  recordedAt?: string;
  recordedBy: number;
}

export class PatientModel {
  
  // 환자 생성
  static async create(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient> {
    const query = `
      INSERT INTO patients (name, date_of_birth, medical_record_number, contact_number, emergency_contact, room_number, status, admission_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      patientData.name,
      patientData.dateOfBirth,
      patientData.medicalRecordNumber,
      patientData.contactNumber,
      patientData.emergencyContact,
      patientData.roomNumber,
      patientData.status,
      patientData.admissionDate
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // ID로 환자 조회
  static async findById(id: number): Promise<Patient | null> {
    const query = `
      SELECT p.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', vs.id,
                   'heartRate', vs.heart_rate,
                   'bloodPressureSystolic', vs.blood_pressure_systolic,
                   'bloodPressureDiastolic', vs.blood_pressure_diastolic,
                   'temperature', vs.temperature,
                   'oxygenSaturation', vs.oxygen_saturation,
                   'recordedAt', vs.recorded_at
                 ) ORDER BY vs.recorded_at DESC
               ) FILTER (WHERE vs.id IS NOT NULL), '[]'
             ) as vital_signs
      FROM patients p
      LEFT JOIN vital_signs vs ON p.id = vs.patient_id 
        AND vs.recorded_at >= NOW() - INTERVAL '24 hours'
      WHERE p.id = $1
      GROUP BY p.id
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  // 환자 목록 
  static async findAll(options: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}): Promise<{ patients: Patient[]; total: number }> {
    const { page = 1, limit = 20, status, search } = options;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`p.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.medical_record_number ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 전체 카운트
    const countQuery = `SELECT COUNT(*) as total FROM patients p ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 메인 쿼리
    const query = `
      SELECT p.*, 
             vs_latest.heart_rate as latest_heart_rate,
             vs_latest.temperature as latest_temperature,
             vs_latest.recorded_at as last_vitals_recorded
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT heart_rate, temperature, recorded_at
        FROM vital_signs 
        WHERE patient_id = p.id 
        ORDER BY recorded_at DESC 
        LIMIT 1
      ) vs_latest ON true
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const result = await db.query(query, queryParams);

    return { patients: result.rows, total };
  }

  // 환자 정보 업데이트
  static async update(id: number, updates: Partial<Patient>): Promise<Patient | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE patients 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  // 소프트 삭제
  static async delete(id: number): Promise<boolean> {
    const query = `
      UPDATE patients 
      SET status = 'discharged', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await db.query(query, [id]);
    return result.rows.length > 0;
  }

  // 경고 있는 환자 조회
  static async getPatientsWithAlerts(): Promise<Patient[]> {
    const query = `
      SELECT p.*, vs.*, 
             CASE 
               WHEN vs.heart_rate > 100 OR vs.heart_rate < 60 THEN 'heart_rate'
               WHEN vs.temperature > 38.0 OR vs.temperature < 36.0 THEN 'temperature'
               WHEN vs.blood_pressure_systolic > 140 OR vs.blood_pressure_systolic < 90 THEN 'blood_pressure'
               WHEN vs.oxygen_saturation < 95 THEN 'oxygen_saturation'
             END as alert_type
      FROM patients p
      INNER JOIN vital_signs vs ON p.id = vs.patient_id
      WHERE p.status = 'active'
        AND vs.recorded_at >= NOW() - INTERVAL '1 hour'
        AND (
          vs.heart_rate > 100 OR vs.heart_rate < 60
          OR vs.temperature > 38.0 OR vs.temperature < 36.0
          OR vs.blood_pressure_systolic > 140 OR vs.blood_pressure_systolic < 90
          OR vs.oxygen_saturation < 95
        )
      ORDER BY vs.recorded_at DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  // 환자 분석 데이터
  static async getAnalytics(patientId: number, days: number = 7): Promise<any> {
    const query = `
      SELECT 
        DATE(vs.recorded_at) as date,
        AVG(vs.heart_rate) as avg_heart_rate,
        AVG(vs.temperature) as avg_temperature,
        AVG(vs.blood_pressure_systolic) as avg_bp_systolic,
        COUNT(*) as readings_count
      FROM vital_signs vs
      WHERE vs.patient_id = $1
        AND vs.recorded_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(vs.recorded_at)
      ORDER BY date DESC
    `;
    
    const result = await db.query(query, [patientId]);
    return result.rows;
  }
}